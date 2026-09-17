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


-- ============================================================
-- POLÍTICAS: profiles
-- ============================================================

-- SELECT: cada quien ve su propio perfil; el supervisor ve todos
create policy profiles_select on profiles
  for select
  using (
    id = auth.uid()
    or get_user_rol() = 'supervisor'
  );

-- UPDATE: solo supervisor puede cambiar rol / activar-desactivar a otros
create policy profiles_update_supervisor on profiles
  for update
  using (get_user_rol() = 'supervisor');

-- INSERT: nadie inserta directo desde el cliente; solo el trigger

-- ============================================================
-- POLÍTICAS: movimientos_inventario
-- ============================================================

-- SELECT: todos los autenticados activos (documento Sprint 3: "bitácora completa")
create policy mov_select_autenticados on movimientos_inventario
  for select
  using (get_user_rol() is not null);

-- INSERT: solo roles operativos (o vía service_role, que siempre pasa por encima de RLS)
create policy mov_insert_roles_autorizados on movimientos_inventario
  for insert
  with check (get_user_rol() in ('supervisor','metalmecanica','produccion','instalacion','compras'));

-- UPDATE y DELETE: NO se crea ninguna policy a propósito.
-- Sin policy = denegado por defecto. Además las reglas no_update_movimientos
-- y no_delete_movimientos (migración 002) ya lo bloquean a nivel de RULE.

-- ============================================================
-- POLÍTICAS: ajustes_pendientes (Sprint 3 + B9 del PDF de faltantes)
-- ============================================================

-- SELECT: el solicitante ve las suyas; el supervisor las ve todas
-- (esto YA resuelve B9: "producción/compras lean sus propias solicitudes",
-- porque la condición no depende del rol, solo de quién la creó)
create policy ajustes_select_propio_o_supervisor on ajustes_pendientes
  for select
  using (
    solicitado_por = auth.uid()
    or get_user_rol() = 'supervisor'
  );

-- INSERT: roles operativos pueden proponer ajustes
create policy ajustes_insert_roles on ajustes_pendientes
  for insert
  with check (get_user_rol() in ('produccion','instalacion','metalmecanica','compras','supervisor'));

-- UPDATE: solo supervisor puede resolver (aprobar/rechazar)
create policy ajustes_update_supervisor on ajustes_pendientes
  for update
  using (get_user_rol() = 'supervisor');

-- ============================================================
-- POLÍTICAS: catálogos de solo lectura (productos, bodegas, categorías)
-- ============================================================

create policy productos_select on productos
  for select using (get_user_rol() is not null);

create policy bodegas_select on bodegas
  for select using (get_user_rol() is not null);

create policy categorias_select on categorias_inventario
  for select using (get_user_rol() is not null);

-- Sin policies de INSERT/UPDATE/DELETE en catálogos: se gestionan por
-- migraciones o por Edge Functions con service_role (que no pasa por RLS).