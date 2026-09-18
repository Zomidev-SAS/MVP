-- 017_fix_search_path_handle_new_user.sql
-- Corrige un bug real: handle_new_user (migración 001) referenciaba "profiles"
-- sin especificar el schema. Esto funcionaba al crear usuarios desde Studio/
-- PostgREST (su search_path incluye "public" por defecto), pero fallaba al
-- crear usuarios desde GoTrue directo (auth.admin.inviteUserByEmail), porque
-- su conexión a Postgres no hereda el mismo search_path.
--
-- Buena práctica general: toda función SECURITY DEFINER debe fijar su propio
-- search_path explícitamente, para no depender de quién la esté llamando.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nombre, rol)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre',''), 'lectura');
  return new;
end;
$$;