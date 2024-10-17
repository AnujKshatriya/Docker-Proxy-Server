const http = require('http');
const express = require('express');
const cors = require('cors');
const Dockerode = require('dockerode');
const httpProxy = require('http-proxy');
const { Server } = require('socket.io');

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
const proxy = httpProxy.createProxy();

// 1) In-memory database for running containers
const db = new Map();

docker.getEvents((err, stream) => {
    if (err) {
        console.log('Error in getting events', err);
        return;
    }

    stream.on('data', async (chunk) => {
        try {
            if (!chunk) return;

            const event = JSON.parse(chunk.toString());

            if (event.Type === 'container') {
                const container = docker.getContainer(event.id);

                if (event.Action === 'start') {
                    const containerInfo = await container.inspect();
                    const containerName = containerInfo.Name.substring(1);

                    if (!db.has(containerName)) {
                        const networkMode = Object.keys(containerInfo.NetworkSettings.Networks)[0];
                        const ipAddress = containerInfo.NetworkSettings.Networks[networkMode].IPAddress;

                        const exposedPort = Object.keys(containerInfo.Config.ExposedPorts);
                        let defaultPort = null;

                        if (exposedPort.length > 0) {
                            const [port, type] = exposedPort[0].split('/');
                            if (type === 'tcp') defaultPort = port;
                        }

                        const containerData = { containerName, ipAddress, defaultPort, createdAt: new Date().toISOString() };
                        db.set(containerName, containerData);

                        console.log(`Container ${containerName} started.`);

                        // Emit the event to all connected clients
                        io.emit('container-started', containerData);
                    }
                }

                if (event.Action === 'die') {
                    const containerName = event.Actor.Attributes.name;
                    if (db.has(containerName)) {
                        db.delete(containerName);
                        console.log(`Container ${containerName} stopped.`);

                        // Notify clients about container stop
                        io.emit('container-stopped', { containerName });
                    }
                }
            }
        } catch (error) {
            console.error(error);
        }
    });
});

// 2)  Reverse Proxy
const reverseProxyApp = express();

reverseProxyApp.use((req, res) => {
    const subdomain = req.hostname === 'localhost' ? 'localhost' : req.hostname.split('.')[0];

    if (!db.has(subdomain)) {
        console.log('No subdomain found...');
        return res.status('404').end('404');
    }

    const { ipAddress, defaultPort } = db.get(subdomain);

    const proxyTarget = `http://${ipAddress}:${defaultPort}`;

    console.log(`Forwarding ${req.hostname} --> ${proxyTarget}`);

    return proxy.web(req, res, { target: proxyTarget, changeOrigin: true });
});

const reverseProxy = http.createServer(reverseProxyApp);

// 3)  Management API
const managementAPI = express();
managementAPI.use(express.json());
managementAPI.use(express.urlencoded({ extended: true }));
managementAPI.use(cors({ origin: 'http://localhost:5173' }));

// Create the HTTP server and attach Socket.IO
const httpServer = http.createServer(managementAPI);
const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

// Emit the container list when a client connects
io.on('connection', (socket) => {
    console.log('New client connected');
    socket.emit('containers', Array.from(db.values()));
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// POST request to create and start a container
managementAPI.post('/containers', async (req, res) => {
    const { image, tag = 'latest' } = req.body;

    if (!image) {
        return res.status(400).json({ status: 'error', message: 'Image is required' });
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

    try {
        if (!imgExist) {
            console.log(`Pulling Image: ${image}:${tag}`);
            await new Promise((resolve, reject) => {
                docker.pull(`${image}:${tag}`, (err, stream) => {
                    if (err) {
                        return reject(err);
                    }
                    docker.modem.followProgress(stream, (err, res) => err ? reject(err) : resolve(res));
                });
            });
        }

        const container = await docker.createContainer({
            Image: `${image}:${tag}`,
            Tty: false,
            HostConfig: {
                AutoRemove: true
            }
        });

        await container.start();

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
        const currentTime = new Date().toISOString();
        db.set(containerName, { containerName, ipAddress, defaultPort, createdAt: currentTime });

        return res.json({
            status: 'success',
            container: `${containerName}.localhost`,
            createdAt: currentTime
        });
    } catch (error) {
        console.error('Error starting container:', error);
        return res.status(500).json({ status: 'error', message: 'Failed to start container' });
    }
});

// GET request to list running containers
managementAPI.get('/containers', (req, res) => {
    const containerList = Array.from(db.values());
    res.json({ containers: containerList });
});

// DELETE request to stop and remove a container
const removalInProgress = new Set();

managementAPI.delete('/containers/:name', async (req, res) => {
    const { name } = req.params;

    if (removalInProgress.has(name)) {
        console.log(`Container removal in progress for: ${name}`);
        return res.status(409).json({ status: 'error', message: 'Container removal is already in progress' });
    }

    removalInProgress.add(name);

    try {
        const container = docker.getContainer(name);
        const containerInfo = await container.inspect();

        if (!containerInfo) {
            return res.status(404).json({ status: 'error', message: 'Container not found' });
        }

        console.log(`Stopping and removing container: ${name}`);

        await container.stop();
        db.delete(name);

        return res.json({ status: 'success', message: `Container ${name} stopped and removed` });
    } catch (error) {
        console.error('Error stopping/removing container:', error);
        return res.status(500).json({ status: 'error', message: 'Failed to stop/remove container' });
    } finally {
        removalInProgress.delete(name);
    }
});

// Start servers
httpServer.listen(8080, () => {
    console.log('Management API with Socket.IO listening on port 8080');
});

reverseProxy.listen(80, () => {
    console.log('Reverse Proxy is running on port 80');
});
