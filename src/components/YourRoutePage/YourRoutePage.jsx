import React from 'react';

import { useHistory } from 'react-router-dom';
import RegisterForm from '../RegisterForm/RegisterForm';

function RegisterPage() {
  const history = useHistory();

  return (
    //How to get multiple buttons - one for each client with this field tech's id?
    <div>
      <center>  
        <button
          type="button"
          className="btn"
          onClick={() => {
            history.push('/ClientVisitPage');
          }}
        >ClientName 
        </button>
      </center>
    </div>
    
  );
}

export default RegisterPage;
