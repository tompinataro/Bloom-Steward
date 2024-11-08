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
              history.push('/AdminClientListPage');
            }}
          >  Client List
          </button>
          <h2> </h2>
          <h2> </h2>
          <button
            type="button"
            className="btn"
            onClick={() => {
              history.push('/AdminTimelyNotesPage');
            }}
          >  Timely Notes
          </button>
          <h2> </h2>
          <h2> </h2>
          <button
            type="button"
            className="btn"
            onClick={() => {
              history.push('/AdminFieldTechListPage');
            }}
          >  Field Tech List
          </button>
          <h2> </h2>
          <h2> </h2>
          <button
            type="button"
            className="btn"
            onClick={() => {
              history.push('/AdminDataEntryPage');
            }}
          >  Data Entry
          </button>
          <h4> ___________________</h4>
          <LogOutButton className="btn" />
        </div>
      </center>
    </div>
  );
}

export default AdminLandingPage;
