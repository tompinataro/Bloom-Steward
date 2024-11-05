import React from 'react';
import { useHistory } from 'react-router-dom';

function AdminClientListPage() {
  const history = useHistory();

  return (
    <div>
      <center>
      <div className="container">
      <h1>Client List</h1>
{/* Insert Client List Table
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

export default AdminClientListPage;
