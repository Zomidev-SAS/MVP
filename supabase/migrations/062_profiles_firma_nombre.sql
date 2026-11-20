-- 062: nombre con el que se imprime la firma del administrador en los documentos.
-- (profiles.nombre es el usuario corto, p. ej. "ana.arango".)
alter table profiles add column if not exists firma_nombre text;
