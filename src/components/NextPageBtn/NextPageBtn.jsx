import React from 'react';
import { useHistory } from 'react-router-dom';


function NextPageBtn(props) {
    const history = useHistory();

    return (
        <div>
            <center>
                <button
                    type="button"
                    className={props.className}
                    onClick={() => {
                        history.push('/EnterNextPage');
                    }}
                > Next Page ▶︎ </button>
            </center>
        </div>
    );
}

export default NextPageBtn;