-- Función helper: rol del usuario actual, solo si está activo
create or replace function get_user_rol()
returns text language sql security definer stable as $$
  select rol from profiles where id = auth.uid() and activo = true
$$;

alter table profiles enable row level security;
alter table movimientos_inventario enable row level security;
alter table ajustes_pendientes enable row level security;
alter table productos enable row level security;
alter table bodegas enable row level security;
alter table categorias_inventario enable row level security;

drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select
  using (
    id = auth.uid()
    or get_user_rol() = 'supervisor'
  );

drop policy if exists profiles_update_supervisor on profiles;
create policy profiles_update_supervisor on profiles
  for update
  using (get_user_rol() = 'supervisor');

drop policy if exists mov_select_autenticados on movimientos_inventario;
create policy mov_select_autenticados on movimientos_inventario
  for select
  using (get_user_rol() is not null);

drop policy if exists mov_insert_roles_autorizados on movimientos_inventario;
create policy mov_insert_roles_autorizados on movimientos_inventario
  for insert
  with check (get_user_rol() in ('supervisor','metalmecanica','produccion','instalacion','compras'));

drop policy if exists ajustes_select_propio_o_supervisor on ajustes_pendientes;
create policy ajustes_select_propio_o_supervisor on ajustes_pendientes
  for select
  using (
    solicitado_por = auth.uid()
    or get_user_rol() = 'supervisor'
  );

drop policy if exists ajustes_insert_roles on ajustes_pendientes;
create policy ajustes_insert_roles on ajustes_pendientes
  for insert
  with check (get_user_rol() in ('produccion','instalacion','metalmecanica','compras','supervisor'));

drop policy if exists ajustes_update_supervisor on ajustes_pendientes;
create policy ajustes_update_supervisor on ajustes_pendientes
  for update
  using (get_user_rol() = 'supervisor');

drop policy if exists productos_select on productos;
create policy productos_select on productos
  for select using (get_user_rol() is not null);

drop policy if exists bodegas_select on bodegas;
create policy bodegas_select on bodegas
  for select using (get_user_rol() is not null);

drop policy if exists categorias_select on categorias_inventario;
create policy categorias_select on categorias_inventario
  for select using (get_user_rol() is not null);
