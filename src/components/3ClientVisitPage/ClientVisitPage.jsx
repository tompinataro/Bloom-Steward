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

          {/* // Arrival Timestamp <Button></Button>
            // TimelyNoteField - if any
            // Comment Form <w />
            // <SubmitButton></SubmitButton>
            // Departure Timestamp <Button></Button>
          */}
 
          <button
            type="button"
            className="btn"
            onClick={() => {
              history.push('/_________'); //sends to login page
            }}
          > Button Name Goes Here
          </button>
        </div>
      </center>
    </div>
  );


  export default ClientVisitPage;
