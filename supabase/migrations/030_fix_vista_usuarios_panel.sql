-- La vista une auth.users; el rol authenticated no tiene SELECT ahí.
-- security_invoker = false: corre como owner (postgres) y puede leer emails.
-- get_user_rol() sigue filtrando solo supervisores.

create or replace view public.vista_usuarios_panel
with (security_invoker = false)
as
select
  p.id,
  p.nombre,
  u.email,
  p.rol,
  p.activo,
  p.created_at
from public.profiles p
join auth.users u on u.id = p.id
where public.get_user_rol() = 'supervisor';

grant select on public.vista_usuarios_panel to authenticated;
