-- Panel: lectura de formularios (vehiculosapp escribe con sus propias policies).
alter table formularios enable row level security;

drop policy if exists formularios_select_panel on formularios;
create policy formularios_select_panel on formularios
  for select using (get_user_rol() is not null);

grant select on formularios to authenticated;
