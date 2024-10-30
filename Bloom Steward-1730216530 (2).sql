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

CREATE TABLE IF NOT EXISTS "user" (
	"id" serial NOT NULL UNIQUE,
	"username" varchar(100) NOT NULL UNIQUE,
	"user_type" bigint NOT NULL,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "client_visits" (
	"id" serial NOT NULL UNIQUE,
	"client_id" bigint NOT NULL UNIQUE,
	"field_tech_id" bigint NOT NULL UNIQUE,
	"assigned_date" date NOT NULL DEFAULT CURRENT_DATE,
	"start_time" timestamp with time zone,
	"complete_time" timestamp with time zone,
	"timely_note" varchar(500),
	"timely_image" varchar(255),
	"tech_comment" varchar(500),
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "client_list" (
	"id" serial NOT NULL UNIQUE,
	"client_name" varchar(80) NOT NULL,
	"client_address" varchar(120) NOT NULL,
	"client_phone" varchar(14) NOT NULL UNIQUE,
	PRIMARY KEY ("id")
);

ALTER TABLE "user" ADD CONSTRAINT "user_fk0" FOREIGN KEY ("id") REFERENCES "client_visits"("field_tech_id");

ALTER TABLE "client_list" ADD CONSTRAINT "client_list_fk0" FOREIGN KEY ("id") REFERENCES "client_visits"("client_id");

