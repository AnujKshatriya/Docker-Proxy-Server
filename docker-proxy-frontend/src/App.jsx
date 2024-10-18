import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import ContainerList from './components/ContainerList';
import "./App.css";

function App() {
  const [containers, setContainers] = useState([]);

  const [image, setImage] = useState('');
  const [tag, setTag] = useState('');

  const createContainer = async () => {
    try {
      // Set default tag if none is provided
      const validImage = image.trim();
      const validTag = tag.trim() || 'latest';
  
      // Check for valid Docker image name
      if (!validImage.match(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/)) {
        console.error('Invalid image name format');
        return;
      }
  
      const response = await fetch('http://localhost:8080/containers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: validImage, tag: validTag })
      });
  
      if (response.ok) {
        const data = await response.json();
        setContainers([...containers, { containerName: data.container.split('.')[0], createdAt: data.createdAt }]);
      } else {
        console.error("Failed to create container:", data.message);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };
  

  useEffect(() => {
    // Connect to the Socket.IO server
    const socket = io('http://localhost:8080');

    // Fetch the initial list of containers
    fetchContainers();

    // Listen for real-time updates
    socket.on('container-started', (containerData) => {
      setContainers((prevContainers) => [...prevContainers, containerData]);
    });

    socket.on('container-stopped', ({ containerName }) => {
      setContainers((prevContainers) =>
        prevContainers.filter((container) => container.containerName !== containerName)
      );
    });

    return () => {
      socket.disconnect(); // Cleanup when component unmounts
    };
  }, []);

  const fetchContainers = async () => {
    try {
      const response = await axios.get('http://localhost:8080/containers');
      setContainers(response.data.containers);
    } catch (error) {
      console.error("Error fetching containers:", error);
    }
  };

  const deleteContainer = async (containerName) => {
    try {
      await axios.delete(`http://localhost:8080/containers/${containerName}`);
      setContainers(containers.filter(container => container.containerName !== containerName));
    } catch (error) {
      console.error("Error deleting container:", error);
    }
  };

  return (
    <div className="App">
      <h1>Container Management</h1>
      <div className="container-form">
        <input 
          type="text" 
          placeholder="Image Name" 
          value={image} 
          onChange={(e) => setImage(e.target.value)} 
        />
        <input 
          type="text" 
          placeholder="Tag (default: latest)" 
          value={tag} 
          onChange={(e) => setTag(e.target.value)} 
        />
        <button onClick={createContainer}>Create Container</button>
      </div>
      <ContainerList containers={containers} deleteContainer={deleteContainer} />
    </div>
  );
}

export default App;
