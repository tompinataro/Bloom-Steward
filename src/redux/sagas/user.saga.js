import axios from 'axios';
import { put, takeLatest } from 'redux-saga/effects';

// worker Saga: will be fired on "FETCH_USER" actions
function* fetchUser() {
  try {
    const token = localStorage.getItem('auth_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      yield put({ type: 'UNSET_USER' });
      return;
    }
    const response = yield axios.get('/api/auth/me', { headers: { 'Content-Type': 'application/json' } });
    const user = response.data?.user || {};
    yield put({ type: 'SET_USER', payload: user });
  } catch (error) {
    console.log('User get request failed', error);
    localStorage.removeItem('auth_token');
    delete axios.defaults.headers.common['Authorization'];
    yield put({ type: 'UNSET_USER' });
  }
}

function* userSaga() {
  yield takeLatest('FETCH_USER', fetchUser);
}

export default userSaga;
