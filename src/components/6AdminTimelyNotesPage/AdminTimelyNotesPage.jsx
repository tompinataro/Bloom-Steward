import React from 'react';
import { useHistory } from 'react-router-dom';

function AdminTimelyNotePage() {
  const history = useHistory();

  return (
    <div>
      <center>
      <div className="container">
      <h1>Timely Notes</h1>
{/* Enter Form for Timely Notes
*/}
        <button
          type="button"
          className="btn"
          onClick={() => {
            history.push('/_______');
          }}
        >
        </button>
        </div>
      </center>
    </div>
  );
}

export default AdminTimelyNotePage;
