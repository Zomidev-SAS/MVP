-- B2: Realtime publicado y versionado.
-- Agrega a supabase_realtime las tablas que el panel necesita ver actualizarse
-- en vivo. Todas ya tienen RLS habilitado (movimientos_inventario: 008,
-- ajustes_pendientes: 008, ordenes_compra: 025, formularios: 019,
-- eventos_sistema: 031), así que Realtime respeta esos mismos permisos por rol:
-- un usuario solo recibe por el socket las filas que también podría leer por SELECT.
--
-- 'notificaciones' se agrega en la migración de B3 (033), porque esa tabla se
-- crea ahí. No existe todavía en este punto, por eso no se incluye aquí.

-- Requisito de Postgres: para que Realtime pueda enviar el registro OLD/NEW
-- completo en updates (útil para ajustes_pendientes y ordenes_compra, donde
-- el panel necesita ver el estado anterior), se fija REPLICA IDENTITY FULL.
alter table ajustes_pendientes replica identity full;
alter table ordenes_compra     replica identity full;

-- movimientos_inventario es solo-insert (RULEs de 002), con REPLICA IDENTITY
-- por defecto (primary key) es suficiente.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'movimientos_inventario'
  ) then
    alter publication supabase_realtime add table movimientos_inventario;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'ajustes_pendientes'
  ) then
    alter publication supabase_realtime add table ajustes_pendientes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'ordenes_compra'
  ) then
    alter publication supabase_realtime add table ordenes_compra;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'formularios'
  ) then
    alter publication supabase_realtime add table formularios;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'eventos_sistema'
  ) then
    alter publication supabase_realtime add table eventos_sistema;
  end if;
end $$;
