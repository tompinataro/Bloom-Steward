-- Minimal schema for MVP

create table if not exists users (
  id serial primary key,
  email text unique not null,
  name text not null,
  password_hash text not null default ''
);

create table if not exists clients (
  id serial primary key,
  name text not null,
  address text not null default ''
);

-- Today's routes for a user (simple denormalized association for MVP)
create table if not exists routes_today (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  client_id integer not null references clients(id) on delete cascade,
  scheduled_time text not null
);

create table if not exists visits (
  id serial primary key,
  client_id integer not null references clients(id) on delete cascade,
  scheduled_time text not null
);

create table if not exists visit_checklist (
  visit_id integer not null references visits(id) on delete cascade,
  key text not null,
  label text not null,
  done boolean not null default false,
  primary key (visit_id, key)
);

create table if not exists visit_submissions (
  id serial primary key,
  visit_id integer not null references visits(id) on delete cascade,
  notes text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Visit state per day and user (Sprint 8)
create table if not exists visit_state (
  visit_id integer not null references visits(id) on delete cascade,
  date date not null,
  user_id integer not null references users(id) on delete cascade,
  status text not null check (status in ('in_progress','completed')),
  created_at timestamptz not null default now(),
  primary key (visit_id, date, user_id)
);
