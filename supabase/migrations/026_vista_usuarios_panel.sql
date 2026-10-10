-- Vista para la página /usuarios: expone el correo de auth.users solo a supervisores.

create or replace view vista_usuarios_panel as
select
  p.id,
  p.nombre,
  u.email,
  p.rol,
  p.activo,
  p.created_at
from public.profiles p
join auth.users u on u.id = p.id
where get_user_rol() = 'supervisor';

grant select on vista_usuarios_panel to authenticated;
