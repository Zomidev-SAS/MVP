-- seed_usuarios.sql
-- Versión final y corregida: incluye TODOS los campos que GoTrue necesita
-- para que estos usuarios puedan hacer login de verdad (no solo existir
-- en la tabla). Reemplaza cualquier seed.sql anterior.
--
-- Aprendido a las malas en esta sesión:
--   - instance_id debe ser '00000000-0000-0000-0000-000000000000'
--   - los *_token deben ser '' (cadena vacía), NUNCA NULL
--   - created_at / updated_at no pueden quedar NULL
--   - confirmed_at es una columna GENERADA, nunca se debe incluir en el INSERT

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change, email_change_token_current, phone_change,
  phone_change_token, reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'supervisor@test.local', crypt('test1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"Ana Ruiz"}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'comercial@test.local', crypt('test1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"Luis Gómez"}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'produccion@test.local', crypt('test1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"Carla Herrera"}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'compras@test.local', crypt('test1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"Marco Salcedo"}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'auditoria@test.local', crypt('test1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"Julia Peña"}', now(), now(), '', '', '', '', '', '', '', '');

update profiles set rol = 'supervisor' where id = '11111111-1111-1111-1111-111111111111';
update profiles set rol = 'comercial'  where id = '22222222-2222-2222-2222-222222222222';
update profiles set rol = 'produccion' where id = '33333333-3333-3333-3333-333333333333';
update profiles set rol = 'compras'    where id = '44444444-4444-4444-4444-444444444444';
update profiles set rol = 'auditoria'  where id = '55555555-5555-5555-5555-555555555555';