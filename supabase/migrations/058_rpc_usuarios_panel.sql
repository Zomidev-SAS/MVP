-- 058: reemplaza la vista vista_usuarios_panel por una función RPC.
--
-- Contexto: el linter de Supabase marcaba la vista como "Security Definer View"
-- y "Exposed Auth Users". Al aplicar la corrección automática la vista pasó a
-- security_invoker=on y el rol authenticated no puede leer auth.users
-- ("permission denied for table users"), con lo que la pantalla Usuarios falló
-- (React #441 en producción).
--
-- Solución: una función SECURITY DEFINER explícita, con search_path vacío, que
-- solo devuelve filas al supervisor y no es ejecutable por anon. Los emails
-- dejan de estar detrás de una vista del esquema expuesto.

create or replace function public.rpc_usuarios_panel()
returns table (
  id uuid,
  nombre text,
  email text,
  rol text,
  activo boolean,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if public.get_user_rol() is distinct from 'supervisor' then
    return;
  end if;

  return query
    select p.id, p.nombre, u.email::text, p.rol, p.activo, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at;
end;
$$;

revoke all on function public.rpc_usuarios_panel() from public, anon;
grant execute on function public.rpc_usuarios_panel() to authenticated, service_role;

drop view if exists public.vista_usuarios_panel;
