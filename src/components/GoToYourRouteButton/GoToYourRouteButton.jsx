import React from 'react';
import { useHistory } from 'react-router-dom';

// import { useDispatch } from 'react-redux';

function GoToYourRouteButton(props) {
    //   const dispatch = useDispatch();
    const history = useHistory();

    return (
        <div>
            <center>
                <button
                    type="button"
                    className={props.className}
                    onClick={() => {
                        history.push('/YourRoutePage');  //????????????????
                    }}
                >   GoToYourRoute </button>
            </center>
        </div>
    );
}

export default GoToYourRouteButton;

//code above is from logout button
//****************************************************************** */
// code below is from register page and has button as link that wasn't used

// import React from 'react'; //already on line 1

// import { useHistory } from 'react-router-dom';  //copied above to line 2
// import RegisterForm from '../RegisterForm/RegisterForm';

// function RegisterPage() {
//   const history = useHistory(); //copied above to line 8

//   return (
//     <div>
{/* <RegisterForm /> */ }

{/* <center>
    <button
        type="button"
        className="btn btn_asLink"
        onClick={() => {
            history.push('/login');
        }}
    >

//         {/* THIS TEXT WAS THE CLICKABLE EVENT >>> Already registered? Log in here... */}
//     </button>
// </center> */}
//     </div>
//   );
// }

// export default RegisterPage;
