import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import LogOutButton from '../LogOutButton/LogOutButton';
import TempAdminAccessBtn from '../TempAdminAccessBtn/TempAdminAccessBtn';
function YourRoutePage() {
  const dispatch = useDispatch();
  const history = useHistory();


  // Access clients data from Redux
  const clients = useSelector((state) => state.todaysVisitsReducer); // Ensure 'clients' matches Redux state structure

  useEffect(() => {
    // Dispatch action to fetch data when component mounts
    if (clients.length === 0) { // Only dispatch if clients is initially empty
      console.log("Dispatching TODAYS_VISITS");
      dispatch({ type: 'TODAYS_VISITS' });
    }
  }, []); // Depend only on dispatch and clients length to avoid re-dispatching

  // // Update button label based on first client name (or other logic)
  // useEffect(() => {
  //   console.log("Clients in Your Route Page:", clients);
  //   if (clients && clients.length > 0) {
  //     setButtonLabel(clients[0].client_name); // Example: Set label to first client's name
  //   }
  // }, [clients]); // Only run when clients data changes

  // Handle button click to navigate to ClientVisit details page
  const handleClientClick = (client) => {
    console.log("Navigating to details for:", client); // Log client click
    dispatch({ type: 'SET_CURRENT_VISIT', payload: client });
    history.push(`/ClientVisitPage/`);
  };

  return (
    <div>
      <center>
        <div className="container">
          <h1  style={{ marginBottom: '60px' }}  // Adds space below each button
          >Your Route</h1>
          
          {/* Display filtered clients as buttons */}
          <div>
            {clients && clients.length > 0 ? (
              clients.map((client, index) => (
                <button
                  type="button"
                  className="btn"
                  key={index}
                  style={{ marginBottom: '30px' }}  // Adds space below each button
                  onClick={() => handleClientClick(client)}>
                  {client.client_name}
                </button>

              ))

            ) : (     // <<< Ternary "if else" shortcut
              <p> Route error, please call the main office...</p>
            )}
          </div>
          <LogOutButton className="btn"
          />
        </div>
      </center>
    </div>
  );
}

export default YourRoutePage;