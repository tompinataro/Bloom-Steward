import React from 'react';

import { useHistory } from 'react-router-dom';
// import RegisterForm from '../RegisterForm/RegisterForm';

function ClientVisitPage() {
  const history = useHistory();

  return (
    <div>
      {/* <RegisterForm /> */}

      <center>
        <button
          type="button"
          className="btn btn_asLink"
          onClick={() => {
            history.push('/login'); //sends to login page
          }}
        >
           Already registered? Log in here...
        </button>
      </center>
    </div>
  );
}

export default RegisterPage;
