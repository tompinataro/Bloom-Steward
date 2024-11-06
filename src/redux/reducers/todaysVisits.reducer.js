const todaysVisitsReducer = (state = [], action) => {
    switch (action.type) {
        case 'SET_TODAYS_VISITS':
            return action.payload;
        default:
            return state;
    }
};

export default todaysVisitsReducer;
