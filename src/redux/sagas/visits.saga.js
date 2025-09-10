import { put, takeLatest } from 'redux-saga/effects';
import axios from 'axios';


//will send an axios GET request to the server using the /api/visits
function* todaysVisits(_action) {
  try {
    const token = localStorage.getItem('auth_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    const res = yield axios.get('/api/routes/today');
    const routes = res.data?.routes || [];
    const mapped = routes.map(r => ({ id: r.id, client_name: r.clientName, address: r.address, scheduled_time: r.scheduledTime }));
    yield put({ type: 'SET_TODAYS_VISITS', payload: mapped });
  } catch (error) {
    console.log('there was an error in the visits saga: ', error);
  }
}

function* visitsSaga () {
    yield takeLatest('TODAYS_VISITS', todaysVisits)
}

export default visitsSaga
