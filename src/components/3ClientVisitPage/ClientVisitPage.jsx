import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import TimestampButton from '../TimestampButton/TimestampButton';

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
    console.log("Dispatching CURRENT_VISIT");
    dispatch({ type: 'CURRENT_VISIT' });
  }, []);

  return (
    <div>
      <center>
        <div className="container">
          <h2>Today at</h2>
          <h2>{ClientName}</h2>

          <TimestampButton className="btn" />


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


          <button
            type="button"
            className="btn"
            onClick={() => {
              ; //sends timestamp to db
            }}
          > DEPARTURE
          </button>

        </div>
      </center>
    </div>
  );
}

export default ClientVisitPage;
