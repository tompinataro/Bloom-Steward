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
          <h2>Welcome, {user.username}!</h2>
          <p>Your ID is: {user.id}</p>

          <GoToYourRouteButton className="btn" />

          <LogOutButton className="btn" />
        </div>
      </center>
    </div>
  );
}

// this allows us to use <App /> in index.js
export default UserPage;