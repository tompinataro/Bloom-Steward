-- USER is a reserved keyword with Postgres
-- You must use double quotes in every query that user is in:
-- ex. SELECT * FROM "user";
-- Otherwise you will have errors!
CREATE TABLE "user" (
    "id" SERIAL PRIMARY KEY,
    "username" VARCHAR (80) UNIQUE NOT NULL,
    "password" VARCHAR (1000) NOT NULL
); 

-- NB: The above has been replaced by 
-- Bloom Steward-1730216530 (2)   <<< The insx in this file needed to be adjusted because it included 
-- "alter" commands that we no longer needed
-- and the field_tech_id needed to be made 'unique'
-- with these changes made to Bloom Steward-1730216530 (2) 
-- the query succeeded:
-- CREATE TABLE
-- CREATE TABLE
-- CREATE TABLE
-- ALTER TABLE
-- ALTER TABLE