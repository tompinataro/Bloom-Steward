import { put, takeLatest } from 'redux-saga/effects';
import axios from 'axios';


//will send an axios GET request to the server using the /api/visits
function* todaysVisits (action) {
    // console.log('inside the visits saga')
    try {
        const todaysVisits = yield axios.get('/api/visits')

        // console.log('response from /api/visits: ', todaysVisits)
        yield put({
            type: 'SET_TODAYS_VISITS',
            payload: todaysVisits.data
        })
    }
    catch (error) {
        console.log('there was an error in the visits saga: ', error);
    }
}

function* visitsSaga () {
    yield takeLatest('TODAYS_VISITS', todaysVisits)
}

export default visitsSaga