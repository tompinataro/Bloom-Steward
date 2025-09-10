import { put, takeLatest } from 'redux-saga/effects';
import axios from 'axios';

// worker Saga: will be fired on "LOGIN" actions
function* loginUser(action) {
  try {
    yield put({ type: 'CLEAR_LOGIN_ERROR' });
    const { username, password } = action.payload || {};
    const res = yield axios.post('/api/auth/login', { email: username, password }, { headers: { 'Content-Type': 'application/json' } });
    const { token, user } = res.data || {};
    if (token) {
      localStorage.setItem('auth_token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    yield put({ type: 'SET_USER', payload: user || {} });
  } catch (error) {
    console.log('Error with user login:', error);
    if (error?.response?.status === 401) {
      yield put({ type: 'LOGIN_FAILED' });
    } else {
      yield put({ type: 'LOGIN_FAILED_NO_CODE' });
    }
  }
}

// worker Saga: will be fired on "LOGOUT" actions
function* logoutUser(_action) {
  try {
    localStorage.removeItem('auth_token');
    delete axios.defaults.headers.common['Authorization'];
    yield put({ type: 'UNSET_USER' });
  } catch (error) {
    console.log('Error with user logout:', error);
  }
}

function* loginSaga() {
  yield takeLatest('LOGIN', loginUser);
  yield takeLatest('LOGOUT', logoutUser);
}

export default loginSaga;
