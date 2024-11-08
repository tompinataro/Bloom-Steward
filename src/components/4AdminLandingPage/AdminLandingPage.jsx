import React from 'react';
import { useHistory } from 'react-router-dom';
import LogOutButton from '../LogOutButton/LogOutButton';

function AdminLandingPage() {
  const history = useHistory();

  return (
    <div>
      <center>
        <div className="container">
          <h1>Admin Main</h1>
          <h1> _________</h1>


          <button
            type="button"
            className="btn"
            onClick={() => {
              history.push('/______');
            }}
          >  Client List
          </button>
          <h2> </h2>
          <h2> </h2>
          <button
            type="button"
            className="btn"
            onClick={() => {
              history.push('/______');
            }}
          >  Timely Notes
          </button>
          <h2> </h2>
          <h2> </h2>
          <button
            type="button"
            className="btn"
            onClick={() => {
              history.push('/______');
            }}
          >  Field Tech List
          </button>
          <h2> </h2>
          <h2> </h2>
          <button
            type="button"
            className="btn"
            onClick={() => {
              history.push('/______');
            }}
          >  Data Entry
          </button>
          <h1> _________</h1>
          <LogOutButton className="btn" />
        </div>
      </center>
    </div>
  );
}

export default AdminLandingPage;
