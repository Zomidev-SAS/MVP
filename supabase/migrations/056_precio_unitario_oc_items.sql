-- Precio unitario por línea de OC, requerido para crear la factura de compra
-- en Siigo (antes se enviaba price = 0).
--  - Nullable: las OC anteriores no lo tienen; hay que editarlas y agregarlo
--    antes de poder marcarlas como 'listo'.
--  - rpc_marcar_oc_listo falla de inmediato (con mensaje claro) si alguna línea
--    no tiene precio, en vez de dejar la OC en 'error' de Siigo después.
alter table orden_compra_items
  add column if not exists precio_unitario numeric
  check (precio_unitario is null or precio_unitario > 0);

create or replace function rpc_marcar_oc_listo(
  p_orden_id   bigint,
  p_medio_pago text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden ordenes_compra%rowtype;
begin
  if coalesce(get_user_rol(), '') not in ('supervisor', 'compras') then
    raise exception 'Solo compras o supervisor pueden marcar una orden como lista';
  end if;

  select * into v_orden from ordenes_compra where id = p_orden_id for update;
  if not found then
    raise exception 'Orden de compra % no existe', p_orden_id;
  end if;

  if v_orden.estado = 'cancelada' then
    raise exception 'La orden % está cancelada, no se puede marcar como lista', p_orden_id;
  end if;

  if v_orden.siigo_id is null and exists (
    select 1 from orden_compra_items
    where orden_id = p_orden_id and (precio_unitario is null or precio_unitario <= 0)
  ) then
    raise exception 'La orden % tiene líneas sin precio unitario. Edítala y agrega el precio antes de marcarla como lista.', p_orden_id;
  end if;

  update ordenes_compra
  set
    estado        = 'listo',
    finalizada_at = coalesce(v_orden.finalizada_at, now()),
    medio_pago    = coalesce(p_medio_pago, v_orden.medio_pago),
    siigo_estado  = case when v_orden.siigo_id is not null
                         then v_orden.siigo_estado
                         else 'enviando'
                    end,
    updated_at    = now()
  where id = p_orden_id;

  if v_orden.siigo_id is not null then
    return jsonb_build_object('ok', true, 'ya_sincronizada', true, 'siigo_id', v_orden.siigo_id);
  end if;

  perform fn_llamar_edge_function(
    'siigo-sync-oc',
    jsonb_build_object('orden_id', p_orden_id)
  );

  return jsonb_build_object('ok', true, 'ya_sincronizada', false);
end;
$$;

revoke execute on function rpc_marcar_oc_listo(bigint, text) from public, anon;
grant execute on function rpc_marcar_oc_listo(bigint, text) to authenticated;
