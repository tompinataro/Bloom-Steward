import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import ArrivalTimestampButton from '../ArrivalTimestamp Button/ArrivalTimestampButton';
import DepartureTimestampButton from '../DepartureTimestamp Button copy/DepartureTimestampButton';
import TempAdminAccessBtn from '../TempAdminAccessBtn/TempAdminAccessBtn';
import GoToYourRouteButton from '../GoToYourRouteButton/GoToYourRouteButton';
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

  // const handleClientClick = (client) => {
  //   console.log("Navigating to details for:", client); // Log client click
  //   dispatch({ type: 'SET_CURRENT_VISIT', payload: client });
  //   history.push(`/ClientVisitPage/`);

  return (
    <div>
      <center>
        <div className="container">
          <h1 style={{ marginBottom: '0px' }}  // Adds space below each button
          >Today at</h1>
          <h1 style={{ marginTop: '0px' }}  // Adds space below each button
          >{client.client_name}</h1>
          <h2> </h2>
          <h2> </h2>


          <ArrivalTimestampButton className="btn" />

          <h2></h2>

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
          >
            <h3 style={{ marginBottom: '0px', marginTop: '5px' }}>
              Timely Note:
            </h3>
            <h5 style={{ marginBottom: '0px', marginTop: '5px' }}>
              3rd floor planter: bugs
            </h5>
          </button>
          <h2> </h2>
          <h2> </h2>
          <button
            type="button"
            className="btn" // use smaller button
            onClick={() => {
              ; //sends comment to db
            }}
          > Click to Respond
          </button>
          <h2> </h2>
          <h2> </h2>

          <DepartureTimestampButton className="btn" />
          <h2> </h2>
          <h2> </h2>
          <GoToYourRouteButton className="btn"/>
          <TempAdminAccessBtn />


        </div>
      </center >
    </div >
  );
}

export default ClientVisitPage;
