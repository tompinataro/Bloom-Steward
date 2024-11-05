import React from 'react';
import { useHistory } from 'react-router-dom';

function AdminLandingPage() {
  const history = useHistory();

  return (
    <div>
      <center>
      <div className="container">
      <h1>Admin Main</h1>
{/* // Four Buttons
    // Client List
    // Timely Notes
    // Field Tech List
    // Data Entry 
*/}
        <button
          type="button"
          className="btn"
          onClick={() => {
            history.push('/______');
          }}
        >
        </button>
        </div>
      </center>
    </div>
  );
}

export default AdminLandingPage;
