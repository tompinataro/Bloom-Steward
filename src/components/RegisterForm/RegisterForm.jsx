import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

function RegisterForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const errors = useSelector((store) => store.errors);
  const dispatch = useDispatch();

  const registerUser = (event) => {
    event.preventDefault();

    dispatch({
      type: 'REGISTER',
      payload: {
        username: username,
        password: password,
      },
    });
  }; // end registerUser

  return (
  
    <form className="formPanel" onSubmit={registerUser}>
      <h2>
      <input className="btn" type="submit" name="submit" value="Register Panel" />

      </h2>
      {errors.registrationMessage && (
        <h3 className="alert" role="alert">
          {errors.registrationMessage}
        </h3>
      )}
      <div>
        <label htmlFor="username">
          {/* Username: */}
          <input
            type="text"
            name="username"
            value={username}
            required
            placeholder="   Enter Username"  // Added this line
            className="btn" 
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
      </div>
      <div>
        <label htmlFor="password">
          {/* Password: */}
          <input
            className="btn" 
            type="password"
            name="password"
            value={password}
            required
            placeholder="   Enter Password"  // Added this line
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      </div>
      <div>
        <input className="btn"  type="submit" name="submit" value="Submit Form" />
      </div>
    </form>
  );
}

export default RegisterForm;
