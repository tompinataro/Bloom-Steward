-- Seed demo data for MVP
insert into users (email, name, password_hash)
values ('demo@example.com', 'Demo User', '')
on conflict (email) do nothing;

insert into clients (name, address) values
  ('Acme HQ', '123 Main St'),
  ('Blue Sky Co', '456 Oak Ave'),
  ('Sunset Mall', '789 Pine Rd')
on conflict do nothing;

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
cross join (values ('watered','Watered plants'),('pruned','Pruned and cleaned'),('replaced','Replaced unhealthy plants')) as x(key,label)
on conflict do nothing;

-- Populate routes_today for the demo user
insert into routes_today (user_id, client_id, scheduled_time)
select u.id, c.id, t.scheduled_time
from users u
join (values ('Acme HQ','09:00'),('Blue Sky Co','10:30'),('Sunset Mall','13:15')) as t(name, scheduled_time)
join clients c on c.name = t.name
where u.email = 'demo@example.com';

