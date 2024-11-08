import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

function ArrivalTimestampButton(props) {
  const dispatch = useDispatch();
  return (
    <button
      className={props.className}
      onClick={() => dispatch({ type: 'TIMESTAMP' })}
    >
      Check-in
    </button>
  );
}

export default ArrivalTimestampButton;

// 1.	React Button Component: The button, when clicked, 
// sends a PUT request to update the start_time field of 
// the specific client_visits row based on visitId.
// 2.	Express PUT Route: The route /api/client_visits/:id/start_time receives the visitId in the URL and the start_time in the request body, then updates the corresponding row in the client_visits table.
// 3.	Database Update: The SQL command updates only the start_time column of the specified row, leaving other fields unaffected.