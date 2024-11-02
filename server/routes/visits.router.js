const express = require('express');
const {
    rejectUnauthenticated,
  } = require('../modules/authentication-middleware');
const pool = require('../modules/pool');
const router = express.Router();

// GET route requests all columns from clientVisits from database 
// (ultimately for only the authenticated field_tech_id)
// route sends an array back to the visits saga
router.get('/visits', rejectUnauthenticated, (req, res) => {
    // console.log('/api/Visits received a request.')

    sqlText = `
        SELECT * FROM "client_visits";
    `;

    pool.query (sqlText)
        .then((result) => {
            res.send(result.rows);
        })
        .catch((dbErr) => {
            console.log('Error GET /api/client_visits ', dbErr);
            res.sendStatus(500);
        });
})

//POST route sends an INSERT query to add a row the client_visits table
router.post('/visits', rejectUnauthenticated, async (req, res) => {
    console.log('visits router request', req.body)
    let connection;
    try {
        connection = await pool.connect()

        await connection.query('BEGIN;')

        for (let visit of req.body) {
            const { client_id, field_tech_id, timely_note } = visit
            console.log(client_id,field_tech_id, timely_note)
        }

        await connection.query('Commit;')

        res.sendStatus(201);
    } catch (error) {
        console.log('error in /api/visits/ POST route: ', error)
        await connection.query('ROLLBACK;')
        res.sendStatus(500);
    } finally {
        await connection.release()
    }
});


//DELETE route sends a DELETE query to the client_visits table
router.delete('/visits/:id', rejectUnauthenticated, (req, res) => {
	console.log('in /api/visits DELETE route and the param is: ', req.params)

	const visitToDelete = req.params.id;

	//delete a row from the client_visits table
	const sqlText = `
		DELETE FROM "client_visits"
			WHERE "id" = $1;
	`;

	const sqlValue = [visitToDelete];

	pool.query (sqlText, sqlValue)
		.then((result) => {
			res.sendStatus(200);
		})
		.catch((dbErr) => {
			console.log('error in /client_visit/:id DELETE route: ', dbErr)
			res.sendStatus(500);
		})
})


//PUT route sends an UPDATE query to change the
// field_tech_id on client_visits table
router.put('/field_tech_id/:id', rejectUnauthenticated, async (req, res) => {
    const { client_Name, field_Tech_Id } = req.body;
    
    console.log(`Received request to update field_tech_id to ${fieldTechId} for client: ${clientName}`);

		const queryText = `
            UPDATE client_visits
			SET field_tech_id = $1
            WHERE client_id = (
              SELECT id FROM client_list WHERE name = $2
		`;

		try {
            // Run the query to update field_tech_id based on client_name
            await pool.query(queryText, [fieldTechId, clientName]);
            res.sendStatus(200);
          } catch (err) {
            console.error('Error updating field tech ID:', err);
            res.sendStatus(500);
          }
        });
        
        module.exports = router;