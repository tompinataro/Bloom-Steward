import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import ArrivalTimestampButton from '../ArrivalTimestamp Button/ArrivalTimestampButton';
import DepartureTimestampButton from '../DepartureTimestamp Button copy/DepartureTimestampButton';
function ClientVisitPage() {
  const dispatch = useDispatch();
  const history = useHistory();
  //************
  // Access client data from Redux
  // For Client Visit Page the h2 is ClientName
  // Does const client need to be ClientName?
  const client = useSelector((state) => state.currentVisit); // Ensure 'clients' matches Redux state structure

  useEffect(() => {
    // Dispatch action to fetch data when component mounts
    //if (clients.length === 0) { // Only dispatch if clients is initially empty
    // console.log("Dispatching CURRENT_VISIT");
    // dispatch({ type: 'CURRENT_VISIT' });
  }, []);

  return (
    <div>
      <center>
        <div className="container">
          <h1>Today at</h1>
          <h1>{client.client_name}</h1>

          <ArrivalTimestampButton className="btn" />


          {/* // TimelyNoteField - (if any, can be null)

            // Comment Form 
            <w />
            // <CommentSubmitButton> SUBMIT </Button> */}

          <button
            type="button"
            className="btn" // use smaller button
            onClick={() => {
              ; //sends comment to db
            }}
          > SUBMIT COMMENT
          </button>


          <DepartureTimestampButton className="btn" />


        </div>
      </center>
    </div>
  );
}

export default ClientVisitPage;
