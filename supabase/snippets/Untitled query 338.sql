update auth.users set
  instance_id = '00000000-0000-0000-0000-000000000000',
  aud = 'authenticated',
  role = 'authenticated',
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now()),
  raw_app_meta_data = coalesce(raw_app_meta_data, '{"provider":"email","providers":["email"]}')
where email like '%@test.local';


select id, email, instance_id, aud, role, created_at
from auth.users
where email = 'supervisor@test.local';

select id, estado, motivo_rechazo, resuelto_por, resuelto_at
from ajustes_pendientes
where id = 2;

insert into ajustes_pendientes (movimiento_borrador, solicitado_por)
values (
  '{"codigo_producto": "10050", "cantidad": 3, "bodega": "ALMACEN NIVEL 2", "motivo": "Ingreso manual no registrado"}',
  '44444444-4444-4444-4444-444444444444'
);

select id from ajustes_pendientes order by id desc limit 1;

select id, codigo_producto, tipo_movimiento, cantidad, bodega, motivo, actor_id, aprobado_por, idempotency_key
from movimientos_inventario
where id = 1573;

select id, estado, resuelto_por, resuelto_at
from ajustes_pendientes
where id = 3;

select count(*) from auth.users;

select id, nombre, rol, activo
from profiles
where id = 'fa8496d0-2409-4491-a9fd-8aa4c43748df';

select id, nombre, rol, activo
from profiles
where id = 'fa8496d0-2409-4491-a9fd-8aa4c43748df';


update profiles set activo = true where id = 'fa8496d0-2409-4491-a9fd-8aa4c43748df';