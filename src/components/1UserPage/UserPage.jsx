import React from 'react';
import GoToYourRouteButton from '../GoToYourRouteButton/GoToYourRouteButton';
import LogOutButton from '../LogOutButton/LogOutButton';
import { useSelector } from 'react-redux';

function UserPage() {
  const user = useSelector((store) => store.user);
  return (
    <div>
      <center>
        <div className="container">
          <h1>Welcome, {user.username}!</h1>
          <h2>Your ID is: {user.id}</h2>

          <GoToYourRouteButton className="btn" />

          <LogOutButton className="btn" />
        </div>
      </center>
    </div>
  ); 
}

// this allows us to use <App /> in index.js
export default UserPage;
