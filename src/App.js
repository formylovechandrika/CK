import React, { useState } from 'react';
import axios from 'axios';

const App = () => {
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    console.log("button pressed")
    setUploadMessage('');
    if (!file) {
      setUploadMessage('Please select a file first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('https://ck-git-main-salt-spidys-projects.vercel.app/api/upload', formData, {        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadMessage('Video uploaded successfully!');
      setFile(null); // Clear file input
    } catch (error) {
      setUploadMessage('Error uploading video.');
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>Video Upload</h1>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload} style={{ marginLeft: '10px' }}>Upload Video</button>
      <p>{uploadMessage}</p>
    </div>
  );
};

export default App;