-- Endurece rpc_aprobar_oc_siigo (044), que ahora funciona como reintento manual
-- porque el envío normal se dispara al marcar la OC como 'listo' (053):
--  1. Chequeo de rol null-safe (get_user_rol() NULL no debe dejar pasar).
--  2. Si ya hay un envío en curso ('enviando'), no dispara otro (evita doble
--     envío / carrera con el disparo automático de rpc_marcar_oc_listo).
create or replace function rpc_aprobar_oc_siigo(p_orden_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden ordenes_compra%rowtype;
begin
  if coalesce(get_user_rol(), '') not in ('supervisor', 'compras') then
    raise exception 'Sin permiso para aprobar órdenes hacia Siigo';
  end if;

  select * into v_orden from ordenes_compra where id = p_orden_id for update;
  if not found then
    raise exception 'Orden de compra % no existe', p_orden_id;
  end if;

  if v_orden.estado = 'cancelada' then
    raise exception 'La orden % está cancelada, no se envía a Siigo', p_orden_id;
  end if;

  if v_orden.siigo_id is not null then
    return jsonb_build_object('ok', true, 'ya_sincronizada', true, 'siigo_id', v_orden.siigo_id);
  end if;

  if v_orden.siigo_estado = 'enviando' then
    return jsonb_build_object('ok', true, 'ya_sincronizada', false, 'en_proceso', true);
  end if;

  update ordenes_compra set siigo_estado = 'enviando' where id = p_orden_id;

  perform fn_llamar_edge_function('siigo-sync-oc', jsonb_build_object('orden_id', p_orden_id));

  return jsonb_build_object('ok', true, 'ya_sincronizada', false);
end;
$$;

revoke execute on function rpc_aprobar_oc_siigo(bigint) from public, anon;
grant execute on function rpc_aprobar_oc_siigo(bigint) to authenticated;

revoke execute on function rpc_marcar_oc_listo(bigint, text) from public, anon;
grant execute on function rpc_marcar_oc_listo(bigint, text) to authenticated;
