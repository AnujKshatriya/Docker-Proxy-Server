import React from 'react';

function ContainerList({ containers, deleteContainer }) {
    return (
        <div className="container-list">
            {containers.map((container) => (
                <div key={container.containerName} className="container-item">
                    <div className="container-info">
                        <h2>{container.containerName}</h2>
                        <p>URL: <span className="url">{`http://${container.containerName}.localhost`}</span></p>
                        <p>Created At: {new Date(container.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="container-actions">
                        <a 
                            href={`http://${container.containerName}.localhost`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                        >
                            Access
                        </a>
                        <button onClick={() => deleteContainer(container.containerName)}>
                            Delete
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default ContainerList;
