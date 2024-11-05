import React from 'react';
import { useHistory } from 'react-router-dom';

function AdminFieldTechListPage() {
  const history = useHistory();

  return (
    <div>
      <center>
      <div className="container">
      <h1>Field Tech List</h1>
{/* Insert Field Tech Table
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

export default AdminFieldTechListPage;
