import axios from 'axios';
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';

function YourRoutePage(props) {
  const store = useSelector((store) => store);
  const [heading, setHeading] = useState('Functional Component');
  const [clients, setClients] = useState([]);
  const history = useHistory();

  useEffect(() => {
    const requestOptions = {
      method: "GET",
      redirect: "follow"
    };

    axios.get('/api/visits/')
      .then((data) => {
        console.log (data, "The data");
        // Filter for rows with tech id = 1 and extract client names
        // const filteredClients = data
        //   .filter((item) => item.tech_id === 1)
        //   .map((item) => item.client_name);
        // setClients(filteredClients);
      })
      .catch((error) => console.error("Error:", error));
  }, []);

  // Handle button click to navigate to client details page
  const handleClientClick = (clientName) => {
    history.push(`/client-details/${clientName}`);
  };

  return (
    <div>
      <h2>{heading}</h2>
      <div>
        {clients.map((client, index) => (
          <button key={index} onClick={() => handleClientClick(client)}>
            {client}
          </button>
        ))}
      </div>
    </div>
  );
}

export default YourRoutePage;
