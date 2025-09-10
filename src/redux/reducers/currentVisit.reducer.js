const currentVisit = (state = {}, action) => {
    switch (action.type) {
        case 'SET_CURRENT_VISIT':
            return action.payload;
        
        case 'CLEAR_CURRENT_VISIT':
            return {}; // Clears the visits
        
        default:
            return state;
    }
};
export default currentVisit;
