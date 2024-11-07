const currentVisit = (state = [], action) => {
    switch (action.type) {
        case 'SET_TODAYS_VISITS':
            console.log("CurrentVisit Reducer received visits data:", action.payload);
            return action.payload;
        
        case 'CLEAR_CURRENT_VISIT':
            return []; // Clears the visits
        
        case 'ADD_VISIT':
            return [...state, action.payload]; // Adds a single visit to the list

        case 'REMOVE_VISIT':
            return state.filter(visit => visit.id !== action.payload); // Removes a visit by ID
            
        default:
            return state;
    }
};
export default currentVisit;