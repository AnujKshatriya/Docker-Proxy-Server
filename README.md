# Docker Reverse Proxy Service

This project provides a reverse proxy for Docker containers, along with a React frontend for container management. In addition to proxying, it allows users to list, create, and stop Docker containers, with real-time updates powered by Socket.IO..

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Directory Structure](#directory-structure)
- [License](#license)

## Features

- List all running Docker containers
- Create new containers with specified images and tags
- Delete existing containers
- Real-time updates using Socket.IO
- User-friendly React frontend

## Prerequisites

Before you begin, ensure you have the following installed:

- [Docker](https://www.docker.com/products/docker-desktop) (Docker Desktop recommended)
- [Docker Compose](https://docs.docker.com/compose/install/) (usually included with Docker Desktop)
- [Node.js](https://nodejs.org/) (for local development)

## Getting Started

1. **Clone the repository:**

```bash
git clone https://github.com/AnujKshatriya/Docker-Proxy-Server/
cd Docker-Proxy-Server
```
2. **Build the application:**

```bash
npm install
```
3. **Build and run the application using Docker Compose:**

```bash
docker-compose up --build
```
This command will:
1. Build the Docker images for both the frontend and backend, installing neccessary dependency to run backend.
2. Start the application, exposing the frontend on http://localhost:5173 and the reverse proxy management server on http://localhost:8080.

## Usage

1. Access the Frontend:
  • Open your web browser and navigate to http://localhost:5173.
  • You will see the container management interface.

2. Creating a Container:
  • Enter the Docker image name and an optional tag (default is latest).
  • Click the "Create Container" button to create a new Docker container.

3. Managing Containers:
  • The list of running containers will be displayed.
  • You can Stop a container by clicking the "Stop" button next to it.

## Directory Structure
```bash
Copy code
.
├── docker-compose.yml         # Docker Compose configuration
├── Dockerfile.dev             # Dockerfile for the reverse proxy server
├── docker-proxy-frontend/     # React frontend directory
│   ├── Dockerfile              # Dockerfile for the React frontend
│   ├── package.json            # Project dependencies
│   └── src/                   # React source files
└── .dockerignore               # Files to ignore when building Docker images
```

## License
This project is licensed under the MIT License.
