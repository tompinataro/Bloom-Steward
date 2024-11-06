import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';

function YourRoutePage(props) {
  const store = useSelector((store) => store);
  const [heading, setHeading] = useState(YourRoutePage);
  const [clients, setClients] = useState([]);
  const history = useHistory();

  useEffect(() => {
    const requestOptions = {
      method: "GET",
      redirect: "follow"
    };

    // Add your API call or data fetching logic here
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
