-- Seed admin and tech accounts
insert into users (email, name, password_hash, role, must_change_password, managed_password)
values
  ('marc@bloomsteward.com', 'Marc', '$2a$10$EG.3exhuFUnYzAEknAwB5.Mb7o.1FjX.lg7OD/lGibEi5LLzipUl2', 'admin', false, '83472618'),
  ('jacob@b.com', 'Jacob Daniels', '$2a$10$whaYHbgK6XHqK8GwEYaCCevjhE5ah/gcyHXC4oIhrRFoTSnMlMJd.', 'tech', false, 'Jacob123'),
  ('sadie@b.com', 'Sadie Percontra', '$2a$10$whaYHbgK6XHqK8GwEYaCCevjhE5ah/gcyHXC4oIhrRFoTSnMlMJd.', 'tech', false, '50293847'),
  ('chris@b.com', 'Chris Lane', '$2a$10$whaYHbgK6XHqK8GwEYaCCevjhE5ah/gcyHXC4oIhrRFoTSnMlMJd.', 'tech', false, '71920485'),
  ('cameron@b.com', 'Cameron Diaz', '$2a$10$whaYHbgK6XHqK8GwEYaCCevjhE5ah/gcyHXC4oIhrRFoTSnMlMJd.', 'tech', false, '12837465'),
  ('derek@b.com', 'Derek Jeter', '$2a$10$whaYHbgK6XHqK8GwEYaCCevjhE5ah/gcyHXC4oIhrRFoTSnMlMJd.', 'tech', false, '90456123')
on conflict (email) do update set
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = excluded.role,
  must_change_password = excluded.must_change_password,
  managed_password = excluded.managed_password;

insert into service_routes (name)
values ('North'), ('South'), ('East'), ('West'), ('Central'), ('St. Paul')
on conflict (name) do nothing;

-- Assign one route per field tech
update service_routes set user_id = (select id from users where email = 'jacob@b.com') where name = 'North';
update service_routes set user_id = (select id from users where email = 'sadie@b.com') where name = 'South';
update service_routes set user_id = (select id from users where email = 'chris@b.com') where name = 'East';
update service_routes set user_id = (select id from users where email = 'cameron@b.com') where name = 'West';
update service_routes set user_id = (select id from users where email = 'derek@b.com') where name = 'Central';

-- Clients: 6 per route for North through Central, 6 for St. Paul (with geo coordinates)
insert into clients (name, address, service_route_id, latitude, longitude) values
  ('Acme HQ', '123 Main St', (select id from service_routes where name = 'North'), 44.9865, -93.2740),
  ('Blue Sky Co', '456 Oak Ave', (select id from service_routes where name = 'North'), 44.9875, -93.2750),
  ('Sunset Mall', '789 Pine Rd', (select id from service_routes where name = 'North'), 44.9885, -93.2730),
  ('Harbor Plaza', '50 S 6th St', (select id from service_routes where name = 'North'), 44.9855, -93.2760),
  ('Palm Vista Resort', '1000 Nicollet Mall', (select id from service_routes where name = 'North'), 44.9895, -93.2720),
  ('Riverwalk Lofts', '225 3rd Ave S', (select id from service_routes where name = 'North'), 44.9865, -93.2710),
  ('Cedar Ridge', '12 Cedar Ridge Rd', (select id from service_routes where name = 'South'), 44.9645, -93.3040),
  ('Pine Grove', '88 Pine Grove Ln', (select id from service_routes where name = 'South'), 44.9655, -93.3050),
  ('Maple Terrace', '14 Maple Terrace', (select id from service_routes where name = 'South'), 44.9665, -93.3030),
  ('Lakeside Towers', '900 Lake St', (select id from service_routes where name = 'South'), 44.9635, -93.3060),
  ('Summit Square', '210 Summit Ave', (select id from service_routes where name = 'South'), 44.9675, -93.3020),
  ('Greenway Commons', '320 Greenway', (select id from service_routes where name = 'South'), 44.9645, -93.3010),
  ('Bayview Center', '1400 Bayview Dr', (select id from service_routes where name = 'East'), 44.9455, -93.1840),
  ('Harbor Point', '602 Harbor Point Rd', (select id from service_routes where name = 'East'), 44.9465, -93.1850),
  ('Sunrise Lofts', '75 Sunrise Blvd', (select id from service_routes where name = 'East'), 44.9475, -93.1830),
  ('Stonebridge', '480 Stonebridge Ln', (select id from service_routes where name = 'East'), 44.9445, -93.1860),
  ('Oak Ridge', '815 Oak Ridge Ct', (select id from service_routes where name = 'East'), 44.9485, -93.1820),
  ('Riverbend', '63 Riverbend Pkwy', (select id from service_routes where name = 'East'), 44.9455, -93.1810),
  ('Cypress Court', '44 Cypress Ct', (select id from service_routes where name = 'West'), 44.9255, -93.3640),
  ('Silver Lake Plaza', '990 Silver Lake', (select id from service_routes where name = 'West'), 44.9265, -93.3650),
  ('Forest Hills', '221 Forest Hills Dr', (select id from service_routes where name = 'West'), 44.9275, -93.3630),
  ('Hillcrest', '300 Hillcrest Rd', (select id from service_routes where name = 'West'), 44.9245, -93.3660),
  ('Grandview', '777 Grandview Ave', (select id from service_routes where name = 'West'), 44.9285, -93.3620),
  ('Briarwood', '55 Briarwood Way', (select id from service_routes where name = 'West'), 44.9255, -93.3610),
  ('Seaside Villas', '18 Seaside Blvd', (select id from service_routes where name = 'Central'), 45.0065, -93.1440),
  ('Harborview', '901 Harborview Ln', (select id from service_routes where name = 'Central'), 45.0075, -93.1450),
  ('Marina Point', '150 Marina Point Rd', (select id from service_routes where name = 'Central'), 45.0085, -93.1430),
  ('Coral Springs', '402 Coral Springs Dr', (select id from service_routes where name = 'Central'), 45.0055, -93.1460),
  ('Palm Grove', '260 Palm Grove Ct', (select id from service_routes where name = 'Central'), 45.0095, -93.1420),
  ('Ocean Crest', '111 Ocean Crest Blvd', (select id from service_routes where name = 'Central'), 45.0065, -93.1410),
  ('Stone Gate', '88 Park Ave', (select id from service_routes where name = 'St. Paul'), 44.8645, -93.0940),
  ('Verde Plaza', '445 Elm St', (select id from service_routes where name = 'St. Paul'), 44.8655, -93.0950),
  ('Urban Roost', '67 Birch Ln', (select id from service_routes where name = 'St. Paul'), 44.8665, -93.0930),
  ('Crown Point', '202 Ash Pl', (select id from service_routes where name = 'St. Paul'), 44.8635, -93.0960),
  ('Royal Grove', '156 Willow Ave', (select id from service_routes where name = 'St. Paul'), 44.8675, -93.0920),
  ('Haven House', '39 Oak Ter', (select id from service_routes where name = 'St. Paul'), 44.8645, -93.0910)
on conflict do nothing;

-- Visits: one per client, time slots spread through the day
insert into visits (client_id, scheduled_time)
select c.id, t.scheduled_time
from (
  select name, unnest(array['08:00','09:00','10:00','11:00','12:00','13:00']) as scheduled_time from clients where service_route_id = (select id from service_routes where name = 'North')
  union all
  select name, unnest(array['08:15','09:15','10:15','11:15','12:15','13:15']) from clients where service_route_id = (select id from service_routes where name = 'South')
  union all
  select name, unnest(array['08:30','09:30','10:30','11:30','12:30','13:30']) from clients where service_route_id = (select id from service_routes where name = 'East')
  union all
  select name, unnest(array['08:45','09:45','10:45','11:45','12:45','13:45']) from clients where service_route_id = (select id from service_routes where name = 'West')
  union all
  select name, unnest(array['09:00','10:00','11:00','12:00','13:00','14:00']) from clients where service_route_id = (select id from service_routes where name = 'Central')
  union all
  select name, unnest(array['09:00','10:00','11:00','12:00','13:00','14:00']) from clients where service_route_id = (select id from service_routes where name = 'St. Paul')
) as t(name, scheduled_time)
join clients c on c.name = t.name
on conflict do nothing;

-- Checklist items for each visit
insert into visit_checklist (visit_id, key, label, done)
select v.id, x.key, x.label, false
from visits v
cross join (values ('watered','Watered Plants'),('pruned','Pruned and cleaned'),('replaced','Replaced unhealthy plants')) as x(key,label)
on conflict do nothing;

-- Today's routes: align clients to assigned techs (one per client)
insert into routes_today (user_id, client_id, scheduled_time)
select u.id, c.id, v.scheduled_time
from clients c
join service_routes sr on sr.id = c.service_route_id
join users u on u.id = sr.user_id
join lateral (select scheduled_time from visits where client_id = c.id limit 1) v on true
on conflict (client_id) do update set user_id = excluded.user_id, scheduled_time = excluded.scheduled_time;

-- Visit submissions with geo data (mostly green, some gray, one FT with mixed red/green)
-- Jacob (North route) - mostly green (accurate locations)
insert into visit_submissions (visit_id, notes, payload, created_at)
select v.id, 'Completed', jsonb_build_object(
  'checkInTs', now() - interval '2 hours',
  'checkOutTs', now() - interval '1 hour',
  'checkInLoc', jsonb_build_object('lat', c.latitude, 'lng', c.longitude),
  'checkOutLoc', jsonb_build_object('lat', c.latitude + 0.0001, 'lng', c.longitude + 0.0001),
  'odometerReading', 45000 + (c.id * 10)
), now() - interval '1 hour'
from visits v
join clients c on c.id = v.client_id
join service_routes sr on sr.id = c.service_route_id
where sr.name = 'North'
on conflict do nothing;

-- Sadie (South route) - mostly green
insert into visit_submissions (visit_id, notes, payload, created_at)
select v.id, 'Completed', jsonb_build_object(
  'checkInTs', now() - interval '3 hours',
  'checkOutTs', now() - interval '2 hours',
  'checkInLoc', jsonb_build_object('lat', c.latitude, 'lng', c.longitude),
  'checkOutLoc', jsonb_build_object('lat', c.latitude + 0.00005, 'lng', c.longitude + 0.00005),
  'odometerReading', 50000 + (c.id * 10)
), now() - interval '2 hours'
from visits v
join clients c on c.id = v.client_id
join service_routes sr on sr.id = c.service_route_id
where sr.name = 'South'
on conflict do nothing;

-- Chris (East route) - mostly green with 2 gray (no geo data)
insert into visit_submissions (visit_id, notes, payload, created_at)
select v.id, 'Completed', jsonb_build_object(
  'checkInTs', now() - interval '4 hours',
  'checkOutTs', now() - interval '3 hours',
  'checkInLoc', case when v.id % 3 = 0 then null else jsonb_build_object('lat', c.latitude, 'lng', c.longitude) end,
  'checkOutLoc', case when v.id % 3 = 0 then null else jsonb_build_object('lat', c.latitude - 0.00008, 'lng', c.longitude - 0.00008) end,
  'odometerReading', 52000 + (c.id * 10)
), now() - interval '3 hours'
from visits v
join clients c on c.id = v.client_id
join service_routes sr on sr.id = c.service_route_id
where sr.name = 'East'
on conflict do nothing;

-- Cameron (West route) - mostly green
insert into visit_submissions (visit_id, notes, payload, created_at)
select v.id, 'Completed', jsonb_build_object(
  'checkInTs', now() - interval '5 hours',
  'checkOutTs', now() - interval '4 hours',
  'checkInLoc', jsonb_build_object('lat', c.latitude, 'lng', c.longitude),
  'checkOutLoc', jsonb_build_object('lat', c.latitude - 0.00003, 'lng', c.longitude - 0.00003),
  'odometerReading', 48000 + (c.id * 10)
), now() - interval '4 hours'
from visits v
join clients c on c.id = v.client_id
join service_routes sr on sr.id = c.service_route_id
where sr.name = 'West'
on conflict do nothing;

-- Derek (Central route) - PROBLEMATIC: half red (far away), half green (accurate) - indicates potential issue
insert into visit_submissions (visit_id, notes, payload, created_at)
select v.id, 'Completed', jsonb_build_object(
  'checkInTs', now() - interval '6 hours',
  'checkOutTs', now() - interval '5 hours',
  'checkInLoc', jsonb_build_object('lat', c.latitude, 'lng', c.longitude),
  'checkOutLoc', jsonb_build_object(
    'lat', c.latitude + (case when v.id % 2 = 0 then 0.002 else 0.00005 end),
    'lng', c.longitude + (case when v.id % 2 = 0 then 0.002 else 0.00005 end)
  ),
  'odometerReading', 55000 + (c.id * 10)
), now() - interval '5 hours'
from visits v
join clients c on c.id = v.client_id
join service_routes sr on sr.id = c.service_route_id
where sr.name = 'Central'
on conflict do nothing;

-- St. Paul route - mostly green
insert into visit_submissions (visit_id, notes, payload, created_at)
select v.id, 'Completed', jsonb_build_object(
  'checkInTs', now() - interval '7 hours',
  'checkOutTs', now() - interval '6 hours',
  'checkInLoc', jsonb_build_object('lat', c.latitude, 'lng', c.longitude),
  'checkOutLoc', jsonb_build_object('lat', c.latitude + 0.00006, 'lng', c.longitude + 0.00006),
  'odometerReading', 51000 + (c.id * 10)
), now() - interval '6 hours'
from visits v
join clients c on c.id = v.client_id
join service_routes sr on sr.id = c.service_route_id
where sr.name = 'St. Paul'
on conflict do nothing;

