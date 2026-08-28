-- ADVERTENCIA: en producción y staging esta tabla YA EXISTE (según el documento
-- de iniciación, sección 1). Esta migración es SOLO para que tu entorno local
-- tenga la FK que pide movimientos_inventario.formulario_id.
-- No la apliques nunca contra producción — ahí ya existe con su propio esquema.

create table if not exists formularios (
  id   text primary key default gen_random_uuid()::text,
  tipo text,
  data jsonb not null default '{}'
);