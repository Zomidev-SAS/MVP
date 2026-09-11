-- Helpers para políticas basadas en rol del perfil autenticado
create or replace function public.current_user_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol from profiles where id = auth.uid() and activo = true;
$$;

create or replace function public.is_supervisor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(current_user_rol() = 'supervisor', false);
$$;

create or replace function public.can_write_movimientos()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(current_user_rol() in ('supervisor', 'produccion', 'compras'), false);
$$;

create or replace function public.can_solicitar_ajustes()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(current_user_rol() in ('supervisor', 'produccion', 'compras'), false);
$$;

-- profiles
alter table profiles enable row level security;

create policy "usuarios autenticados leen perfiles"
  on profiles for select
  to authenticated
  using (true);

create policy "supervisor actualiza perfiles"
  on profiles for update
  to authenticated
  using (is_supervisor())
  with check (is_supervisor());

-- movimientos_inventario
alter table movimientos_inventario enable row level security;

create policy "usuarios autenticados leen movimientos"
  on movimientos_inventario for select
  to authenticated
  using (true);

create policy "roles autorizados insertan movimientos"
  on movimientos_inventario for insert
  to authenticated
  with check (can_write_movimientos() and actor_id = auth.uid());

-- ajustes_pendientes
alter table ajustes_pendientes enable row level security;

create policy "supervisor lee ajustes pendientes"
  on ajustes_pendientes for select
  to authenticated
  using (is_supervisor());

create policy "roles autorizados solicitan ajustes"
  on ajustes_pendientes for insert
  to authenticated
  with check (can_solicitar_ajustes() and solicitado_por = auth.uid());

create policy "supervisor resuelve ajustes"
  on ajustes_pendientes for update
  to authenticated
  using (is_supervisor())
  with check (is_supervisor());

-- Vistas: acceso de lectura para usuarios autenticados
grant select on vista_inventario_actual to authenticated;
grant select on vista_valorizacion_basica to authenticated;
grant select on vista_movimientos_recientes to authenticated;
