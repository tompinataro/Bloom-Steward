import React from 'react';
import { useHistory } from 'react-router-dom';

function AdminDataEntryPage() {
  const history = useHistory();

  return (
    <div>
      <center>
      <div className="container">
      <h1>Data Entry</h1>
{/* Enter Form of Data Entry fields

*/}
        <button
          type="button"
          className="btn"
          onClick={() => {
            history.push('/_____');
          }}
        >
        </button>
        </div>
      </center>
    </div>
  );
}

export default AdminDataEntryPage;
