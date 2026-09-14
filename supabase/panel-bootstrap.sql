-- =============================================================================
-- BOOTSTRAP DEL PANEL (Supabase Cloud)
-- Para proyectos donde ya existe la APP con usuarios Auth y tablas propias.
--
-- NO borra usuarios Auth.
-- NO borra tablas de la app.
-- Crea solo lo que el panel Next.js necesita.
--
-- Dónde correrlo: Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================================

-- ─── PASO 0: Ver qué hay (solo lectura) ─────────────────────────────────────
-- select table_name from information_schema.tables
--   where table_schema = 'public' order by table_name;
--
-- select u.email, p.rol from auth.users u
--   left join public.profiles p on p.id = u.id;

-- ─── PASO 1: Perfiles del panel ───────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  rol        text not null check (rol in (
                'supervisor','comercial','ingenieria',
                'produccion','compras','auditoria','lectura',
                'metalmecanica','instalacion')),
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Perfil para cada usuario Auth que ya existía (de la app)
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

-- Trigger: auto-crear perfil en usuarios nuevos
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nombre, rol)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre',''), 'lectura')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── PASO 2: Tablas del panel ─────────────────────────────────────────────────
-- formularios: la app probablemente ya la tiene → no la creamos.
-- movimientos_inventario: si la app ya la tiene, este CREATE se salta solo.
create table if not exists public.movimientos_inventario (
  id              bigint generated always as identity primary key,
  vin             text not null check (length(trim(vin)) >= 5),
  tipo_movimiento text not null check (tipo_movimiento in (
                     'entrada','salida_vin','ajuste','reverso')),
  cantidad        numeric(12,2) not null,
  valor_unitario  numeric(14,2),
  marca           text,
  categoria       text,
  ubicacion       text,
  formulario_id   text,
  motivo          text,
  evidencia       jsonb not null default '{}',
  actor_id        uuid not null references auth.users(id),
  aprobado_por    uuid references auth.users(id),
  estado          text not null default 'aplicado'
                    check (estado in ('pendiente','aplicado','rechazado')),
  idempotency_key text unique,
  created_at      timestamptz not null default now()
);

create index if not exists idx_mov_vin
  on public.movimientos_inventario(vin);
create index if not exists idx_mov_tipo_fecha
  on public.movimientos_inventario(tipo_movimiento, created_at desc);
create index if not exists idx_mov_estado_fecha
  on public.movimientos_inventario(estado, created_at desc);

-- Solo agrega reglas si no existen (tabla nueva del panel)
do $$ begin
  create rule no_update_movimientos as on update to public.movimientos_inventario do instead nothing;
exception when duplicate_object then null;
end $$;

do $$ begin
  create rule no_delete_movimientos as on delete to public.movimientos_inventario do instead nothing;
exception when duplicate_object then null;
end $$;

create table if not exists public.ajustes_pendientes (
  id                  bigint generated always as identity primary key,
  movimiento_borrador jsonb not null,
  solicitado_por      uuid not null references auth.users(id),
  estado              text not null default 'pendiente'
                         check (estado in ('pendiente','aprobado','rechazado')),
  motivo_rechazo      text,
  resuelto_por        uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  resuelto_at         timestamptz
);

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

-- ─── PASO 3: Vistas del dashboard ─────────────────────────────────────────────
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

-- ─── PASO 4: RLS ─────────────────────────────────────────────────────────────
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
  on public.ajustes_pendientes for select to authenticated using (public.is_supervisor());
drop policy if exists "roles autorizados solicitan ajustes" on public.ajustes_pendientes;
create policy "roles autorizados solicitan ajustes"
  on public.ajustes_pendientes for insert to authenticated
  with check (public.can_solicitar_ajustes() and solicitado_por = auth.uid());
drop policy if exists "supervisor resuelve ajustes" on public.ajustes_pendientes;
create policy "supervisor resuelve ajustes"
  on public.ajustes_pendientes for update to authenticated
  using (public.is_supervisor()) with check (public.is_supervisor());

alter table public.eventos_calendario enable row level security;
drop policy if exists "usuarios ven solo sus propios eventos" on public.eventos_calendario;
create policy "usuarios ven solo sus propios eventos"
  on public.eventos_calendario for select using (usuario_id = auth.uid());
drop policy if exists "usuarios insertan solo sus propios eventos" on public.eventos_calendario;
create policy "usuarios insertan solo sus propios eventos"
  on public.eventos_calendario for insert with check (usuario_id = auth.uid());
drop policy if exists "usuarios borran solo sus propios eventos" on public.eventos_calendario;
create policy "usuarios borran solo sus propios eventos"
  on public.eventos_calendario for delete using (usuario_id = auth.uid());

-- ─── PASO 5: Tu usuario admin del panel ───────────────────────────────────────
-- ⚠️ CAMBIÁ el email por el tuyo antes de correr:
--
-- update public.profiles
-- set rol = 'supervisor', activo = true
-- where id = (select id from auth.users where email = 'tu-correo@carrera-arango.com');
