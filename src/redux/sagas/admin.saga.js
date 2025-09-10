import { call, put, takeLatest } from 'redux-saga/effects';
import axios from 'axios';

function* updateFieldTech(action) {
  try {
    const token = localStorage.getItem('auth_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    yield call(axios.put, '/api/visits/field-tech', action.payload);

    // Dispatch a success action to update state if needed
    yield put({ type: 'UPDATE_FIELD_TECH_SUCCESS' });

    // Optionally, fetch updated client visits data
    yield put({ type: 'FETCH_CLIENT_VISITS' });
  } catch (error) {
    console.error('Failed to update field tech:', error);
    yield put({ type: 'UPDATE_FIELD_TECH_FAILURE', error });
  }
}
// Watcher saga to listen for UPDATE_FIELD_TECH actions
function* watchUpdateFieldTech() {
    yield takeLatest('UPDATE_FIELD_TECH', updateFieldTech);
  }
  
  export default watchUpdateFieldTech;
