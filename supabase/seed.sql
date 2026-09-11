-- Usuarios de prueba (contraseña: test1234)
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'supervisor@test.local', crypt('test1234', gen_salt('bf')), now(), '{"nombre":"Ana Ruiz"}'),
  ('22222222-2222-2222-2222-222222222222', 'comercial@test.local',  crypt('test1234', gen_salt('bf')), now(), '{"nombre":"Luis Gómez"}'),
  ('33333333-3333-3333-3333-333333333333', 'produccion@test.local', crypt('test1234', gen_salt('bf')), now(), '{"nombre":"Carla Herrera"}'),
  ('44444444-4444-4444-4444-444444444444', 'compras@test.local',    crypt('test1234', gen_salt('bf')), now(), '{"nombre":"Marco Salcedo"}'),
  ('55555555-5555-5555-5555-555555555555', 'auditoria@test.local',  crypt('test1234', gen_salt('bf')), now(), '{"nombre":"Julia Peña"}');

update profiles set rol = 'supervisor' where id = '11111111-1111-1111-1111-111111111111';
update profiles set rol = 'comercial'  where id = '22222222-2222-2222-2222-222222222222';
update profiles set rol = 'produccion' where id = '33333333-3333-3333-3333-333333333333';
update profiles set rol = 'compras'    where id = '44444444-4444-4444-4444-444444444444';
update profiles set rol = 'auditoria'  where id = '55555555-5555-5555-5555-555555555555';

insert into movimientos_inventario (vin, tipo_movimiento, cantidad, valor_unitario, marca, categoria, actor_id, idempotency_key)
select
  'VIN' || lpad(gs::text, 6, '0'),
  case when gs % 5 = 0 then 'ajuste' when gs % 2 = 0 then 'entrada' else 'salida_vin' end,
  case when gs % 2 = 0 then (gs % 10 + 1)::numeric else -1 end,
  round((random() * 500000 + 50000)::numeric, 2),
  (array['Toyota','Mazda','Kia','Renault','Chevrolet'])[(gs % 5) + 1],
  (array['Frenos','Motor','Suspensión','Eléctrico','Carrocería'])[(gs % 5) + 1],
  '11111111-1111-1111-1111-111111111111',
  'seed-mov-' || gs
from generate_series(1, 50) as gs;
