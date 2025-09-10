import React from 'react';
import LoginForm from '../LoginForm/LoginForm';
import { useHistory } from 'react-router-dom';

function LoginPage() {
  const history = useHistory();
  return (
    <div>
      <h1 className="centered">Please Log in</h1>
      <LoginForm />
      <center>
        <button
          type="button"
          className="btn btn_asLink"
          onClick={() => {
            history.push('/registration');
          }}
        >
          Not Yet Registered? Click here...
        </button>
      </center>
    </div>
  );
}

export default LoginPage;
