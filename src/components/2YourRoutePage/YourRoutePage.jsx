import React from 'react';
import { useHistory } from 'react-router-dom';

function YourRoutePage() {
  const history = useHistory();

  return (
    //*************************************************** */
    //How to get multiple buttons - 
    //one for each client with this field tech's id?
    //*************************************************** */

    <div>
      <center>
        <div className="container">
          <h1>Your Route</h1>

          <button
            type="button"
            className="btn"
            onClick={() => {
              history.push('/ClientVisitPage');
            }}
          >ClientName
          </button>
        </div>
      </center>
    </div>

  );
}

export default YourRoutePage;
