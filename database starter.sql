-- NB: The 'database starter.sql' file has been replaced by 
-- this file (Bloom Steward-1730216530 (2))   
-- The insx in this file needed to be adjusted because it included 
-- "alter" commands that we no longer needed
-- and the field_tech_id needed to be made 'unique'
-- with these changes made to Bloom Steward-1730216530 (2) 
-- the query succeeded:
-- CREATE TABLE
-- CREATE TABLE
-- CREATE TABLE
-- ALTER TABLE
-- ALTER TABLE

DROP TABLE IF EXISTS client_visits CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;
DROP TABLE IF EXISTS client_list CASCADE;

CREATE TABLE IF NOT EXISTS "user" (
	"id" serial NOT NULL UNIQUE,
	"username" varchar(100) NOT NULL UNIQUE,
    "password" VARCHAR (1000) NOT NULL
	"user_type" bigint NOT NULL,
	PRIMARY KEY ("id")
);



CREATE TABLE IF NOT EXISTS "client_list" (
	"id" serial NOT NULL UNIQUE,
	"client_name" varchar(80) NOT NULL UNIQUE,
	"client_address" varchar(120) NOT NULL,
	"client_phone" varchar(14) NOT NULL UNIQUE,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "client_visits" (
    "id" serial NOT NULL UNIQUE,
    "client_id" bigint NOT NULL REFERENCES "client_list"("id") ON DELETE CASCADE,
    "field_tech_id" bigint NOT NULL REFERENCES "user"("id") ON DELETE SET NULL,
    "assigned_date" date DEFAULT CURRENT_DATE,
    "start_time" timestamp with time zone,
    "complete_time" timestamp with time zone,
    "timely_note" varchar(500),
    "timely_image" varchar(255),
    "tech_comment" varchar(500),
    PRIMARY KEY ("id")
);


-- INSERT INTO client_visits 
--     (client_id, field_tech_id, start_time, complete_time, timely_note, timely_image, tech_comment) 
-- VALUES 
--     (3001, 5001, '2024-11-01 09:00:00+00', '2024-11-01 09:30:00+00', 'Bugs in planter on 3rd floor', 'na', 'Treated for bugs'),
--     (3002, 5002, '2024-11-01 10:00:00+00', '2024-11-01 10:30:00+00', 'Plants drooping in lobby', 'na', 'Watered them well'),
--     (3003, 5003, '2024-11-01 11:00:00+00', '2024-11-01 11:30:00+00', 'Dead leaves on 2nd floor', 'na', 'Cleaned up leaves'),
--     (3004, 5004, '2024-11-01 12:00:00+00', '2024-11-01 12:30:00+00', 'Spotting palms by pool', 'na', 'Treated palms');
    
--             SELECT * FROM "client_visits";
