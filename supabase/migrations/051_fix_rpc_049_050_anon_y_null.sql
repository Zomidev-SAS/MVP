-- 051: endurece las RPC de 049 y 050.
--
-- Problema: Supabase otorga EXECUTE a anon por default privileges, y
-- "revoke ... from public" no lo quita. Además, para un usuario sin sesión
-- get_user_rol() devuelve NULL, y "NULL <> 'supervisor'" / "NULL not in (...)"
-- evalúa a NULL (no a true), así que el IF no lanzaba la excepción y anon
-- habría podido ejecutar el UPDATE. Se corrige en dos capas:
--   1) revocar EXECUTE a anon,
--   2) validar el rol de forma null-safe (is distinct from / coalesce).

create or replace function rpc_reenviar_correo(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actualizado bigint;
begin
  if get_user_rol() is distinct from 'supervisor' then
    raise exception 'Sin permiso para reenviar correos';
  end if;

  update cola_correos
  set estado = 'pendiente', intentos = 0, error = null
  where id = p_id and estado = 'error'
  returning id into v_actualizado;

  if v_actualizado is null then
    raise exception 'El correo % no existe o no está en estado error', p_id;
  end if;
end;
$$;

create or replace function rpc_marcar_diferencia_siigo_revisada(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actualizado bigint;
begin
  if coalesce(get_user_rol(), '') not in ('supervisor', 'compras') then
    raise exception 'Sin permiso para revisar diferencias de catálogo Siigo';
  end if;

  update siigo_catalogo_diferencias
  set revisado = true
  where id = p_id
  returning id into v_actualizado;

  if v_actualizado is null then
    raise exception 'La diferencia % no existe', p_id;
  end if;
end;
$$;

revoke all on function rpc_reenviar_correo(bigint) from public, anon;
grant execute on function rpc_reenviar_correo(bigint) to authenticated;

revoke all on function rpc_marcar_diferencia_siigo_revisada(bigint) from public, anon;
grant execute on function rpc_marcar_diferencia_siigo_revisada(bigint) to authenticated;
