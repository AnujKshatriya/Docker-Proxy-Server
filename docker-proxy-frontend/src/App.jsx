import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ContainerList from './components/ContainerList';
import "./App.css"

function App() {
    // Dummy data for testing
    const dummyContainers = [
      { containerName: 'webapp', ipAddress: '192.168.1.2', defaultPort: '3000' },
      { containerName: 'api', ipAddress: '192.168.1.3', defaultPort: '4000' },
      { containerName: 'db', ipAddress: '192.168.1.4', defaultPort: '5432' },
  ];

  // Setting dummy data to containers state
  const [containers, setContainers] = useState(dummyContainers);

  const [image, setImage] = useState('');
  const [tag, setTag] = useState('');

  const createContainer = async () => {
    try {
        const response = await fetch('http://localhost:8080/containers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image, tag })
        });

        const data = await response.json();
        console.log(data)
        if (response.ok) {
            const newContainer = {
                containerName: data.container.split('.')[0],
                ipAddress: data.ipAddress,
                defaultPort: data.defaultPort
            };
            setContainers([...containers, newContainer]);
        } else {
            console.error("Failed to create container:", data.message);
        }
    } catch (error) {
        console.error("Error:", error);
    }
  }

    useEffect(() => {
        fetchContainers();
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
