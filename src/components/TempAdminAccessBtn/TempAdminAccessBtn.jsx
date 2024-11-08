import React from 'react';
import { useHistory } from 'react-router-dom';


function TempAdminAccessBtn(props) {

    const history = useHistory();

    return (
        <div>
            <center>
                <button
                    type="button"
                    className={props.className}
                    onClick={() => {
                        history.push('/AdminLandingPage');
                    }}
                >Temp Admin Access</button>
            </center>
        </div>
    );
}

export default TempAdminAccessBtn;