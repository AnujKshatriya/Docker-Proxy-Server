const http = require('http');
const express = require('express');
const Dockerode = require('dockerode');
const httpProxy = require('http-proxy')

const docker = new Dockerode({socketPath: "/var/run/docker.sock"});
const proxy = httpProxy.createProxy();

// 1) Creating a in memory database for storing all running container info..

const db = new Map();

docker.getEvents((err,stream)=>{
    if(err){
        console.log("Error in getting events", err);
        return;
    }

    stream.on("data", async (chunk)=>{
        if(!chunk) return;

        const event = JSON.parse(chunk.toString());

        if(event.Type === 'container' && event.Action === 'start'){ 
            const container = docker.getContainer(event.id);
            const containerInfo = await container.inspect();

            const containerName = containerInfo.Name.substring(1);
            const ipAddress = containerInfo.NetworkSettings.IPAddress;

            const exposedPort = Object.keys(containerInfo.Config.ExposedPorts);
            let defaultPort = null;

            if(exposedPort && exposedPort.length > 0){
                const [port ,type] = exposedPort[0].split('/');
                if(type === 'tcp'){
                    defaultPort = port;
                }
            }
            console.log(`Registering ${containerName}.localhost ---> http://${ipAddress}:${defaultPort}`)
            db.set(container, {containerName, containerInfo, defaultPort});
        }
    })
})


// 2) Creating a Reverse Proxy 

const reveseProxyApp = express();

reveseProxyApp.use((req,res)=>{
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];

    if(!db.has(subdomain)) {
        console.log("No subdomain found...")
        return res.status('404').end('404')
    };

    const { ipAddress, defaultPort } = db.get(subdomain);

    const proxyTarget = `http://${ipAddress}:${defaultPort}`;

    console.log(`Forwarding ${hostname} --> ${proxyTarget}`);

    return proxy.web(req, res, {target:proxyTarget, changeOrigin:true});
})

const reveseProxy = http.createServer(reveseProxyApp);


// 3) Creating a management api to run docker container 

const managementAPI = express();

managementAPI.post("/containers", async (req,res)=>{
    const { image , tag="latest" } = req.body;

    const images = await docker.listImages();
    let imgExist = false;

    for( const systemImage of images){
        for( const systemTag of systemImage.RepoTags){
            if(systemTag === `${image}:${tag}`){
                imgExist = true;
                break;
            }
        }

        if(imgExist) break;
    }

    if(!imgExist){
        console.log(`Pulling Image : ${image}:${tag}`);
        await docker.pull(`${image}:${tag}`)
    }

    const container = await docker.createContainer({
        Image : `${image}:${tag}`,
        Tty : false,
        HostConfig:{
            AutoRemove: true,
        }
    })

    await container.start();

    return res.json({
        status:"success",
        container : `${(await container.inspect()).Name}.localhost`
    })

})


// 4)  Running Ports

managementAPI.listen(8080, ()=> console.log("Management API listening on port 8080"))

reveseProxy.listen(80, ()=>{
    console.log("Reverse Proxy is running on port 80")
})