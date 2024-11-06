const todaysVisitsReducer = (state = [], action) => {
    switch (action.type) {
        case 'SET_TODAYS_VISITS':
            console.log('Today\'s visits:', action.payload);
            return action.payload;
        
        case 'CLEAR_TODAYS_VISITS':
            return []; // Clears the visits
        
        case 'ADD_VISIT':
            return [...state, action.payload]; // Adds a single visit to the list

        case 'REMOVE_VISIT':
            return state.filter(visit => visit.id !== action.payload); // Removes a visit by ID
            
        default:
            return state;
    }
};