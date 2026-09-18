-- 014_grants_service_role.sql
-- service_role debe tener acceso completo a todo el schema, sin depender
-- de privilegios "por defecto" que a veces no se propagan igual en local.
-- Esto es justo lo que permite que las Edge Functions (que corren con
-- service_role) puedan leer y escribir sin restricciones de RLS ni de GRANT.

grant usage on schema public to service_role;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- Para que las tablas que se creen en migraciones FUTURAS también
-- le den acceso automático a service_role, sin tener que repetir esto.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;