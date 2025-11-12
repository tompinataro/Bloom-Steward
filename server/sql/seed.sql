-- Seed demo admin and tech accounts
insert into users (email, name, password_hash, role, must_change_password, managed_password)
values
  ('marc@bloomsteward.com', 'Marc', '$2a$10$EG.3exhuFUnYzAEknAwB5.Mb7o.1FjX.lg7OD/lGibEi5LLzipUl2', 'admin', false, 'Tom'),
  ('demo@example.com', 'Demo User', '$2a$10$whaYHbgK6XHqK8GwEYaCCevjhE5ah/gcyHXC4oIhrRFoTSnMlMJd.', 'tech', false, 'password')
on conflict (email) do update set
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = excluded.role,
  must_change_password = excluded.must_change_password,
  managed_password = excluded.managed_password;

insert into service_routes (name)
values ('North'), ('South'), ('East'), ('West')
on conflict (name) do nothing;

insert into clients (name, address) values
  ('Acme HQ', '123 Main St'),
  ('Blue Sky Co', '456 Oak Ave'),
  ('Sunset Mall', '789 Pine Rd'),
  ('Harbor Plaza', '50 S 6th St'),
  ('Palm Vista Resort', '1000 Nicollet Mall'),
  ('Riverwalk Lofts', '225 3rd Ave S')
on conflict do nothing;

-- Default assignments for demo data
with demo_user as (
  select id from users where email = 'demo@example.com' limit 1
)
update service_routes set user_id = demo_user.id
from demo_user
where name = 'North';

update clients set service_route_id = sr.id
from service_routes sr
where clients.name = 'Acme HQ' and sr.name = 'North';

update clients set service_route_id = sr.id
from service_routes sr
where clients.name = 'Blue Sky Co' and sr.name = 'North';

update clients set service_route_id = sr.id
from service_routes sr
where clients.name = 'Sunset Mall' and sr.name = 'North';

-- Create visits
insert into visits (client_id, scheduled_time)
select c.id, t.scheduled_time
from (values ('Acme HQ','09:00'),('Blue Sky Co','10:30'),('Sunset Mall','13:15')) as t(name, scheduled_time)
join clients c on c.name = t.name
on conflict do nothing;

-- Checklist items for each visit
insert into visit_checklist (visit_id, key, label, done)
select v.id, x.key, x.label, false
from visits v
cross join (values ('watered','Watered Plants'),('pruned','Pruned and cleaned'),('replaced','Replaced unhealthy plants')) as x(key,label)
on conflict do nothing;

update visit_checklist set label = 'Watered Plants' where key = 'watered';
update visit_checklist set label = 'Pruned and cleaned' where key = 'pruned';
update visit_checklist set label = 'Replaced unhealthy plants' where key = 'replaced';

insert into routes_today (user_id, client_id, scheduled_time)
select u.id, c.id, t.scheduled_time
from users u
join (values
  ('Acme HQ','09:00'),
  ('Blue Sky Co','10:30'),
  ('Sunset Mall','13:15')
) as t(name, scheduled_time) on true
join clients c on c.name = t.name
where u.email = 'demo@example.com'
on conflict (client_id) do update set user_id = excluded.user_id, scheduled_time = excluded.scheduled_time;
