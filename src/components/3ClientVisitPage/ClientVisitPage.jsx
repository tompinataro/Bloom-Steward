import React from 'react';
import { useHistory } from 'react-router-dom';

function ClientVisitPage() {
  const history = useHistory();

  return (
    <div>
      <center>
        
      <div className="container">
      <h2>Today's Visit at</h2>
      <h2>ClientName</h2>

        <button
          type="button"
          className="btn"
          onClick={() => {
            history.push('/login'); //sends to login page
          }}
        >
        </button>
        </div>
      </center>
    </div>
  );
}

export default ClientVisitPage;
