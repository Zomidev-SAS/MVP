-- =============================================================================
-- Script INCREMENTAL para Supabase Cloud con tablas y usuarios Auth existentes.
-- NO borra usuarios, NO borra tablas, NO trunca datos.
--
-- Uso: Supabase Dashboard → SQL Editor → pegar y ejecutar por secciones.
-- Revisá cada bloque antes de correrlo; saltá lo que ya exista.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) AUDITORÍA (solo lectura — correr primero)
-- -----------------------------------------------------------------------------
-- select table_name from information_schema.tables
--   where table_schema = 'public' order by table_name;
--
-- select u.id, u.email, p.nombre, p.rol, p.activo
-- from auth.users u
-- left join public.profiles p on p.id = u.id
-- order by u.created_at;

-- -----------------------------------------------------------------------------
-- 1) Perfiles faltantes para usuarios Auth que ya existen (no toca auth.users)
-- -----------------------------------------------------------------------------
insert into public.profiles (id, nombre, rol, activo)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'nombre', split_part(u.email, '@', 1)),
  'lectura',
  true
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 2) Tabla nueva: eventos_calendario (solo si no existe)
-- -----------------------------------------------------------------------------
create table if not exists public.eventos_calendario (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null,
  titulo text not null check (length(trim(titulo)) >= 1),
  nota text,
  created_at timestamptz not null default now()
);

create index if not exists idx_eventos_usuario_fecha
  on public.eventos_calendario(usuario_id, fecha);

alter table public.eventos_calendario enable row level security;

drop policy if exists "usuarios ven solo sus propios eventos" on public.eventos_calendario;
create policy "usuarios ven solo sus propios eventos"
  on public.eventos_calendario for select
  using (usuario_id = auth.uid());

drop policy if exists "usuarios insertan solo sus propios eventos" on public.eventos_calendario;
create policy "usuarios insertan solo sus propios eventos"
  on public.eventos_calendario for insert
  with check (usuario_id = auth.uid());

drop policy if exists "usuarios borran solo sus propios eventos" on public.eventos_calendario;
create policy "usuarios borran solo sus propios eventos"
  on public.eventos_calendario for delete
  using (usuario_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3) Funciones helper para RLS (reemplazo seguro, no borra datos)
-- -----------------------------------------------------------------------------
create or replace function public.current_user_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.profiles where id = auth.uid() and activo = true;
$$;

create or replace function public.is_supervisor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_rol() = 'supervisor', false);
$$;

create or replace function public.can_write_movimientos()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_rol() in ('supervisor', 'produccion', 'compras'), false);
$$;

create or replace function public.can_solicitar_ajustes()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_rol() in ('supervisor', 'produccion', 'compras'), false);
$$;

-- -----------------------------------------------------------------------------
-- 4) RLS en tablas existentes (activa permisos; no elimina filas)
--     Saltá cualquier tabla que no exista en tu proyecto.
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "usuarios autenticados leen perfiles" on public.profiles;
create policy "usuarios autenticados leen perfiles"
  on public.profiles for select to authenticated using (true);

drop policy if exists "supervisor actualiza perfiles" on public.profiles;
create policy "supervisor actualiza perfiles"
  on public.profiles for update to authenticated
  using (public.is_supervisor()) with check (public.is_supervisor());

alter table public.movimientos_inventario enable row level security;

drop policy if exists "usuarios autenticados leen movimientos" on public.movimientos_inventario;
create policy "usuarios autenticados leen movimientos"
  on public.movimientos_inventario for select to authenticated using (true);

drop policy if exists "roles autorizados insertan movimientos" on public.movimientos_inventario;
create policy "roles autorizados insertan movimientos"
  on public.movimientos_inventario for insert to authenticated
  with check (public.can_write_movimientos() and actor_id = auth.uid());

alter table public.ajustes_pendientes enable row level security;

drop policy if exists "supervisor lee ajustes pendientes" on public.ajustes_pendientes;
create policy "supervisor lee ajustes pendientes"
  on public.ajustes_pendientes for select to authenticated
  using (public.is_supervisor());

drop policy if exists "roles autorizados solicitan ajustes" on public.ajustes_pendientes;
create policy "roles autorizados solicitan ajustes"
  on public.ajustes_pendientes for insert to authenticated
  with check (public.can_solicitar_ajustes() and solicitado_por = auth.uid());

drop policy if exists "supervisor resuelve ajustes" on public.ajustes_pendientes;
create policy "supervisor resuelve ajustes"
  on public.ajustes_pendientes for update to authenticated
  using (public.is_supervisor()) with check (public.is_supervisor());

-- -----------------------------------------------------------------------------
-- 5) Vistas (reemplazo seguro si ya existen con otra definición)
--     Solo si las tablas base existen.
-- -----------------------------------------------------------------------------
create or replace view public.vista_inventario_actual as
select
  vin,
  max(marca) as marca,
  max(categoria) as categoria,
  max(ubicacion) as ubicacion,
  sum(cantidad) as saldo,
  max(valor_unitario) as valor_unitario,
  sum(cantidad) * max(coalesce(valor_unitario, 0)) as valor_total,
  max(created_at) as ultimo_movimiento
from public.movimientos_inventario
where estado = 'aplicado'
group by vin;

create or replace view public.vista_valorizacion_basica as
select
  coalesce(categoria, 'Sin categoría') as categoria,
  coalesce(marca, 'Sin marca') as marca,
  sum(saldo) as unidades,
  sum(valor_total) as valor_total
from public.vista_inventario_actual
group by categoria, marca;

create or replace view public.vista_movimientos_recientes as
select m.*, p.nombre as actor_nombre, p.rol as actor_rol
from public.movimientos_inventario m
left join public.profiles p on m.actor_id = p.id
order by m.created_at desc
limit 100;

grant select on public.vista_inventario_actual to authenticated;
grant select on public.vista_valorizacion_basica to authenticated;
grant select on public.vista_movimientos_recientes to authenticated;

-- -----------------------------------------------------------------------------
-- 6) Asignar rol supervisor a TU usuario (editar el email antes de correr)
-- -----------------------------------------------------------------------------
-- update public.profiles
-- set rol = 'supervisor', activo = true
-- where id = (select id from auth.users where email = 'tu-correo@empresa.com');
