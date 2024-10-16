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
        try {
            if(!chunk) return;

            const event = JSON.parse(chunk.toString());

            if (event.Type === 'container' && event.Action === 'start') { 
                const container = docker.getContainer(event.id);
                const containerInfo = await container.inspect();

                const containerName = containerInfo.Name.substring(1);

                 // Check if container is already registered
                 if (db.has(containerName)) {
                    console.log(`Container ${containerName} already registered, skipping...`);
                    return;
                }

                // Fetching the IP Address from Networks
                const networkMode = Object.keys(containerInfo.NetworkSettings.Networks)[0];
                const ipAddress = containerInfo.NetworkSettings.Networks[networkMode].IPAddress;

                const exposedPort = Object.keys(containerInfo.Config.ExposedPorts);
                let defaultPort = null;

                if (exposedPort && exposedPort.length > 0) {
                    const [port, type] = exposedPort[0].split('/');
                    if (type === 'tcp') {
                        defaultPort = port;
                    }
                }

                console.log(`Registering ${containerName}.localhost ---> http://${ipAddress}:${defaultPort}`);
                db.set(containerName, { containerName, ipAddress, defaultPort });
            }

        } catch (error) {
            console.error(error);
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



// 3) Creating a management API to run docker container 

const managementAPI = express();

managementAPI.use(express.json());
managementAPI.use(express.urlencoded({ extended: true }));

    // POST request to create and start a container
managementAPI.post("/containers", async (req, res) => {
    const { image, tag = "latest" } = req.body;

    if (!image) {
        return res.status(400).json({ status: "error", message: "Image is required" });
    }

    const images = await docker.listImages();
    let imgExist = false;

    for (const systemImage of images) {
        for (const systemTag of systemImage.RepoTags) {
            if (systemTag === `${image}:${tag}`) {
                imgExist = true;
                break;
            }
        }
        if (imgExist) break;
    }

    if (!imgExist) {
        console.log(`Pulling Image : ${image}:${tag}`);
        await docker.pull(`${image}:${tag}`);
    }

    const container = await docker.createContainer({
        Image: `${image}:${tag}`,
        Tty: false,
        HostConfig: {
            AutoRemove: true,
        },
    });

    await container.start();

    // Manually inspect and store container details in db
    const containerInfo = await container.inspect();
    const containerName = containerInfo.Name.substring(1);

    const networkMode = Object.keys(containerInfo.NetworkSettings.Networks)[0];
    const ipAddress = containerInfo.NetworkSettings.Networks[networkMode].IPAddress;

    const exposedPort = Object.keys(containerInfo.Config.ExposedPorts);
    let defaultPort = null;

    if (exposedPort && exposedPort.length > 0) {
        const [port, type] = exposedPort[0].split('/');
        if (type === 'tcp') {
            defaultPort = port;
        }
    }

    db.set(containerName, { containerName, ipAddress, defaultPort });

    return res.json({
        status: "success",
        container: `${containerName}.localhost`,
        ipAddress,
        defaultPort
    });
});


//GET request to get all the containers running 
managementAPI.get("/containers", (req, res) => {
    const containerList = Array.from(db.values());
    res.json({ containers: containerList });
});

// DELETE request to stop and remove a container by name
const removalInProgress = new Set();

managementAPI.delete("/containers/:name", async (req, res) => {
    const { name } = req.params;

    // Check if removal is already in progress
    if (removalInProgress.has(name)) {
        console.log(`Container removal in progress for: ${name}`);
        return res.status(409).json({ status: "error", message: "Container removal is already in progress" });
    }

    removalInProgress.add(name);  // Add to set

    try {
        const container = docker.getContainer(name);
        const containerInfo = await container.inspect();

        if (!containerInfo) {
            return res.status(404).json({ status: "error", message: "Container not found" });
        }

        console.log(`Stopping and removing container: ${name}`);

        // Stop the container
        await container.stop();

        // Remove the container from the in-memory database
        db.delete(name);

        return res.json({ status: "success", message: `Container ${name} stopped and removed` });
    } catch (error) {
        console.error("Error stopping/removing container:", error);
        return res.status(500).json({ status: "error", message: "Failed to stop/remove container" });
    } finally {
        removalInProgress.delete(name);  // Always remove from set
    }
});




// 4)  Running Ports

managementAPI.listen(8080, ()=> console.log("Management API listening on port 8080"))

reveseProxy.listen(80, ()=>{
    console.log("Reverse Proxy is running on port 80")
})