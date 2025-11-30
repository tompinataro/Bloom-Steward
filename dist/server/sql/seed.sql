-- Seed demo admin and tech accounts
insert into users (email, name, password_hash, role, must_change_password, managed_password)
values
  ('marc@bloomsteward.com', 'Marc', '$2a$10$EG.3exhuFUnYzAEknAwB5.Mb7o.1FjX.lg7OD/lGibEi5LLzipUl2', 'admin', false, 'Tom'),
  ('jacob@bloomsteward.com', 'Jacob Daniels', '$2a$10$whaYHbgK6XHqK8GwEYaCCevjhE5ah/gcyHXC4oIhrRFoTSnMlMJd.', 'tech', false, 'password'),
  ('sadie@bloomsteward.com', 'Sadie Percontra', '$2a$10$whaYHbgK6XHqK8GwEYaCCevjhE5ah/gcyHXC4oIhrRFoTSnMlMJd.', 'tech', false, 'password'),
  ('chris@bloomsteward.com', 'Chris Lane', '$2a$10$whaYHbgK6XHqK8GwEYaCCevjhE5ah/gcyHXC4oIhrRFoTSnMlMJd.', 'tech', false, 'password'),
  ('cameron@bloomsteward.com', 'Cameron Diaz', '$2a$10$whaYHbgK6XHqK8GwEYaCCevjhE5ah/gcyHXC4oIhrRFoTSnMlMJd.', 'tech', false, 'password'),
  ('drek@bloomsteward.com', 'Derek Jeter', '$2a$10$whaYHbgK6XHqK8GwEYaCCevjhE5ah/gcyHXC4oIhrRFoTSnMlMJd.', 'tech', false, 'password')
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
update service_routes set user_id = (select id from users where email = 'jacob@bloomsteward.com') where name = 'North';
update service_routes set user_id = (select id from users where email = 'sadie@bloomsteward.com') where name = 'South';
update service_routes set user_id = (select id from users where email = 'chris@bloomsteward.com') where name = 'East';
update service_routes set user_id = (select id from users where email = 'cameron@bloomsteward.com') where name = 'West';
update service_routes set user_id = (select id from users where email = 'drek@bloomsteward.com') where name = 'Central';

-- Clients: 6 per route for North through Central, 6 for St. Paul
insert into clients (name, address, service_route_id) values
  ('Acme HQ', '123 Main St', (select id from service_routes where name = 'North')),
  ('Blue Sky Co', '456 Oak Ave', (select id from service_routes where name = 'North')),
  ('Sunset Mall', '789 Pine Rd', (select id from service_routes where name = 'North')),
  ('Harbor Plaza', '50 S 6th St', (select id from service_routes where name = 'North')),
  ('Palm Vista Resort', '1000 Nicollet Mall', (select id from service_routes where name = 'North')),
  ('Riverwalk Lofts', '225 3rd Ave S', (select id from service_routes where name = 'North')),
  ('Cedar Ridge', '12 Cedar Ridge Rd', (select id from service_routes where name = 'South')),
  ('Pine Grove', '88 Pine Grove Ln', (select id from service_routes where name = 'South')),
  ('Maple Terrace', '14 Maple Terrace', (select id from service_routes where name = 'South')),
  ('Lakeside Towers', '900 Lake St', (select id from service_routes where name = 'South')),
  ('Summit Square', '210 Summit Ave', (select id from service_routes where name = 'South')),
  ('Greenway Commons', '320 Greenway', (select id from service_routes where name = 'South')),
  ('Bayview Center', '1400 Bayview Dr', (select id from service_routes where name = 'East')),
  ('Harbor Point', '602 Harbor Point Rd', (select id from service_routes where name = 'East')),
  ('Sunrise Lofts', '75 Sunrise Blvd', (select id from service_routes where name = 'East')),
  ('Stonebridge', '480 Stonebridge Ln', (select id from service_routes where name = 'East')),
  ('Oak Ridge', '815 Oak Ridge Ct', (select id from service_routes where name = 'East')),
  ('Riverbend', '63 Riverbend Pkwy', (select id from service_routes where name = 'East')),
  ('Cypress Court', '44 Cypress Ct', (select id from service_routes where name = 'West')),
  ('Silver Lake Plaza', '990 Silver Lake', (select id from service_routes where name = 'West')),
  ('Forest Hills', '221 Forest Hills Dr', (select id from service_routes where name = 'West')),
  ('Hillcrest', '300 Hillcrest Rd', (select id from service_routes where name = 'West')),
  ('Grandview', '777 Grandview Ave', (select id from service_routes where name = 'West')),
  ('Briarwood', '55 Briarwood Way', (select id from service_routes where name = 'West')),
  ('Seaside Villas', '18 Seaside Blvd', (select id from service_routes where name = 'Central')),
  ('Harborview', '901 Harborview Ln', (select id from service_routes where name = 'Central')),
  ('Marina Point', '150 Marina Point Rd', (select id from service_routes where name = 'Central')),
  ('Coral Springs', '402 Coral Springs Dr', (select id from service_routes where name = 'Central')),
  ('Palm Grove', '260 Palm Grove Ct', (select id from service_routes where name = 'Central')),
  ('Ocean Crest', '111 Ocean Crest Blvd', (select id from service_routes where name = 'Central')),
  ('Stone Gate', '88 Park Ave', (select id from service_routes where name = 'St. Paul')),
  ('Verde Plaza', '445 Elm St', (select id from service_routes where name = 'St. Paul')),
  ('Urban Roost', '67 Birch Ln', (select id from service_routes where name = 'St. Paul')),
  ('Crown Point', '202 Ash Pl', (select id from service_routes where name = 'St. Paul')),
  ('Royal Grove', '156 Willow Ave', (select id from service_routes where name = 'St. Paul')),
  ('Haven House', '39 Oak Ter', (select id from service_routes where name = 'St. Paul'))
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
