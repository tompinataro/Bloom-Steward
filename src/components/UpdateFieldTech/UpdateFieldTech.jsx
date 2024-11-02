import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

// Basic functional component structure for 
//React with default state value setup. 
//When making a new component be sure to replace 
//the component name TemplateFunction with the name for the new component.

function UpdateFieldTech(props) {
    // Using hooks we're creating local state for a "heading" variable with
  // a default value of 'Functional Component'
  const store = useSelector((store) => store);

  // State for heading, client name, and field tech ID
  const [heading, setHeading] = useState('Update Field Technician');
  const [client_Name, setClient_Name] = useState();
  const [field_Tech_Id, setField_Tech_Id] = useState();

  // Use dispatch for dispatching Redux actions

  const dispatch = useDispatch();

// Function to dispatch the update action
  const updateFieldTech = () => {
    dispatch({
      type: 'UPDATE_FIELD_TECH',
      payload: {
        client_Name: client_Name,
        field_Tech_Id: field_TechId,
      },
    });
  };


  return (
    <div>
      <h2>{"Update Field Tech"}</h2>
      <p>Client: {client_Name}</p>
      <p>New Field Tech ID: {field_Tech_Id}</p>
      <button onClick={updateFieldTech}>Update Field Tech</button>
    </div>
  );
}

export default UpdateFieldTech;
