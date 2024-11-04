import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import {useSelector} from 'react-redux';

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const errors = useSelector(store => store.errors);
  const dispatch = useDispatch();

  const login = (event) => {
    event.preventDefault();

    if (username && password) {
      dispatch({
        type: 'LOGIN',
        payload: {
          username: username,
          password: password,
        },
      });
    } else {
      dispatch({ type: 'LOGIN_INPUT_ERROR' });
    }
  }; // end login

  return (
    <form className="formPanel" onSubmit={login}>
      {/* <h2>Existing User Log-in</h2> */}
      <input className="btn" type="submit" name="submit" value="User Log-in" />

      {/* <button class="btn-heading" role="heading" aria-level="2">Button Heading</button> */}

      {errors.loginMessage && (
        <h3 className="alert" role="alert">
          {errors.loginMessage}
        </h3>
      )}
      <div>
        <label htmlFor="username">
          {/* Username: */} 
          <input
            className="btn" //added
            type="text"
            name="username"
            required
            value={username}
            placeholder="Enter Username"  // Added this line
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
      </div>
      <div>
        <label htmlFor="password">
          {/* Password: */}
          <input
            className="btn" //added
            type="password"
            name="password"
            required
            value={password}
            placeholder="Enter Password"  // Added this line
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      </div>
      <div>
        <input className="btn" type="submit" name="submit" value="Log-in" />
      </div>
    </form>
  );
}

export default LoginForm;
