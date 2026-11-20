-- 050: marcar una diferencia del catálogo Siigo como revisada.
-- siigo_catalogo_diferencias no tiene UPDATE para authenticated; se hace por
-- RPC con validación de rol (supervisor o compras).

create or replace function rpc_marcar_diferencia_siigo_revisada(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actualizado bigint;
begin
  if get_user_rol() not in ('supervisor', 'compras') then
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

revoke all on function rpc_marcar_diferencia_siigo_revisada(bigint) from public;
grant execute on function rpc_marcar_diferencia_siigo_revisada(bigint) to authenticated;
