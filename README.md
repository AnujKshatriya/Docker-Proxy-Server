# Docker Reverse Proxy with React Frontend

This project provides a simple reverse proxy server using Docker, with a React frontend for container management. It also allows users to list, create, and delete Docker containers, and it uses Socket.IO for real-time updates.

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
   git clone <your-repo-url>
   cd <your-repo-directory>
   ```
Build and run the application using Docker Compose:

```bash
Copy code
docker-compose up --build
```
This command will:

Build the Docker images for both the frontend and backend.
Start the application, exposing the frontend on http://localhost:5173 and the reverse proxy management server on http://localhost:8080.

## Usage

1. Access the Frontend:
  • Open your web browser and navigate to http://localhost:5173.
  • You will see the container management interface.

2. Creating a Container:
  • Enter the Docker image name and an optional tag (default is latest).
  • Click the "Create Container" button to create a new Docker container.

3. Managing Containers:
  • The list of running containers will be displayed.
  • You can delete a container by clicking the "Delete" button next to it.

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
This project is licensed under the MIT License - see the LICENSE file for details.
