import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';

function YourRoutePage(props) {
  const dispatch = useDispatch();
  const history = useHistory();

  // Local state for button label
  const [buttonLabel, setButtonLabel] = useState('Default Label');

  // Access clients and heading data from Redux
  const clients = useSelector((state) => state.clients); // Ensure 'clients' matches your Redux state structure
  const heading = useSelector((state) => state.heading);

  useEffect(() => {
    // Dispatch action to fetch data when component mounts
      console.log("Dispatching TODAYS_VISITS"); // Confirm dispatch
      dispatch({ type: 'TODAYS_VISITS' });
    }, [dispatch]);

  // Update button label based on first client name (or other logic)
  useEffect(() => {
    if (clients && clients.length > 0) {
      setButtonLabel(clients[0].client_name); // Example: Set label to first client's name
    }
  }, [clients]); // Only run when clients data changes

  // Filter clients by tech_id, if needed
  const filteredClients = clients ? clients.filter((client) => client.tech_id === 1) : [];
  console.log("Filtered Clients for tech_id = 1:", filteredClients); // Verify filtered clients

  // Handle button click to navigate to client details page
  const handleClientClick = (clientName) => {
    console.log("Navigating to details for:", clientName); // Log client click
    history.push(`/client-details/${clientName}`);
  };

  return (
    <div>
      <center>
        <h2>Today at</h2>
        <h2>{heading}</h2>
        
        {/* Dynamic button with label */}
        <button onClick={() => handleClientClick(buttonLabel)}>{buttonLabel}</button>

        <div>
          {filteredClients.length > 0 ? (
            filteredClients.map((client, index) => (
              <button key={index} onClick={() => handleClientClick(client.client_name)}>
                {client.client_name}
              </button>
            ))
          ) : (     // Ternary "if else" shortcut
            <p> Route error, please call the main office...</p>
          )}
        </div>
      </center>
    </div>
  );
}

export default YourRoutePage;