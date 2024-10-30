CREATE TABLE IF NOT EXISTS "user" (
	"id" serial NOT NULL UNIQUE,
	"username" varchar(100) NOT NULL UNIQUE,
	"user_type" bigint NOT NULL,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "client_visits" (
	"id" serial NOT NULL UNIQUE,
	"client_id" bigint NOT NULL UNIQUE,
	"field_tech_id" bigint NOT NULL,
	"assigned_date" date NOT NULL DEFAULT 'today's date',
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

ALTER TABLE "user" ADD CONSTRAINT "user_fk1" FOREIGN KEY ("username") REFERENCES "client_visits"("field_tech_name");
ALTER TABLE "client_visits" ADD CONSTRAINT "client_visits_fk6" FOREIGN KEY ("timely_note") REFERENCES "Task_Lists"("timely_task");
ALTER TABLE "client_list" ADD CONSTRAINT "client_list_fk0" FOREIGN KEY ("id") REFERENCES "client_visits"("client_id");

ALTER TABLE "client_list" ADD CONSTRAINT "client_list_fk1" FOREIGN KEY ("client_name") REFERENCES "client_visits"("client_name");

ALTER TABLE "client_list" ADD CONSTRAINT "client_list_fk2" FOREIGN KEY ("client_address") REFERENCES "client_visits"("client_address");

ALTER TABLE "client_list" ADD CONSTRAINT "client_list_fk3" FOREIGN KEY ("client_phone") REFERENCES "client_visits"("client_phone");