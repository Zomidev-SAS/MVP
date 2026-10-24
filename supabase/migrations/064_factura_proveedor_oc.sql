-- 064: número de la factura del proveedor en las OC creadas a mano.
--
-- Siigo rechaza la factura de compra (POST /v1/purchases) sin
-- provider_invoice: "The field provider_invoice is required". Es el prefijo y
-- el número de la factura que emitió el proveedor, y el panel no lo guardaba.
-- Se pide al marcar la OC como lista (que es cuando llega esa factura) y al
-- reintentar un envío fallido.
--
-- Las OC cargadas desde el documento de Siigo (origen = 'documento_siigo') no
-- lo necesitan: no se les crea factura de compra.

alter table ordenes_compra
  add column if not exists factura_proveedor_prefijo text,
  add column if not exists factura_proveedor_numero  text;

-- La firma cambia (se agregan parámetros): se reemplaza la función.
drop function if exists rpc_marcar_oc_listo(bigint, text);

create or replace function rpc_marcar_oc_listo(
  p_orden_id        bigint,
  p_medio_pago      text default null,
  p_factura_prefijo text default null,
  p_factura_numero  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden   ordenes_compra%rowtype;
  v_prefijo text := nullif(trim(coalesce(p_factura_prefijo, '')), '');
  v_numero  text := nullif(trim(coalesce(p_factura_numero, '')), '');
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

  -- La OC se elaboró en Siigo: el panel solo la visualiza, no se envía nada.
  if v_orden.origen = 'documento_siigo' then
    update ordenes_compra
    set estado        = 'listo',
        finalizada_at = coalesce(v_orden.finalizada_at, now()),
        medio_pago    = coalesce(p_medio_pago, v_orden.medio_pago),
        updated_at    = now()
    where id = p_orden_id;
    return jsonb_build_object('ok', true, 'ya_sincronizada', true, 'origen', 'documento_siigo');
  end if;

  if v_orden.siigo_id is null then
    if exists (
      select 1 from orden_compra_items
      where orden_id = p_orden_id and precio_unitario is null
    ) then
      raise exception 'La orden % tiene líneas sin precio unitario. Edítala y agrega el precio (puede ser 0) antes de marcarla como lista.', p_orden_id;
    end if;

    if coalesce(v_numero, v_orden.factura_proveedor_numero) is null then
      raise exception 'Falta el número de la factura del proveedor (Siigo lo exige para crear la factura de compra).';
    end if;
  end if;

  update ordenes_compra
  set
    estado        = 'listo',
    finalizada_at = coalesce(v_orden.finalizada_at, now()),
    medio_pago    = coalesce(p_medio_pago, v_orden.medio_pago),
    factura_proveedor_prefijo = coalesce(v_prefijo, v_orden.factura_proveedor_prefijo),
    factura_proveedor_numero  = coalesce(v_numero,  v_orden.factura_proveedor_numero),
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

revoke execute on function rpc_marcar_oc_listo(bigint, text, text, text) from public, anon;
grant execute on function rpc_marcar_oc_listo(bigint, text, text, text) to authenticated;

-- Reintento manual de un envío fallido: puede traer (o corregir) la factura del
-- proveedor, y sin ella no se dispara nada.
create or replace function rpc_aprobar_oc_siigo(
  p_orden_id        bigint,
  p_factura_prefijo text default null,
  p_factura_numero  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden   ordenes_compra%rowtype;
  v_prefijo text := nullif(trim(coalesce(p_factura_prefijo, '')), '');
  v_numero  text := nullif(trim(coalesce(p_factura_numero, '')), '');
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

  if v_orden.origen = 'documento_siigo' then
    raise exception 'La orden % se cargó desde un documento de Siigo: no se envía de vuelta.', p_orden_id;
  end if;

  if v_orden.siigo_id is not null then
    return jsonb_build_object('ok', true, 'ya_sincronizada', true, 'siigo_id', v_orden.siigo_id);
  end if;

  if v_orden.siigo_estado = 'enviando' then
    return jsonb_build_object('ok', true, 'ya_sincronizada', false, 'en_proceso', true);
  end if;

  if coalesce(v_numero, v_orden.factura_proveedor_numero) is null then
    raise exception 'Falta el número de la factura del proveedor (Siigo lo exige para crear la factura de compra).';
  end if;

  update ordenes_compra
  set siigo_estado = 'enviando',
      factura_proveedor_prefijo = coalesce(v_prefijo, v_orden.factura_proveedor_prefijo),
      factura_proveedor_numero  = coalesce(v_numero,  v_orden.factura_proveedor_numero)
  where id = p_orden_id;

  perform fn_llamar_edge_function('siigo-sync-oc', jsonb_build_object('orden_id', p_orden_id));

  return jsonb_build_object('ok', true, 'ya_sincronizada', false);
end;
$$;

revoke execute on function rpc_aprobar_oc_siigo(bigint, text, text) from public, anon;
grant execute on function rpc_aprobar_oc_siigo(bigint, text, text) to authenticated;
drop function if exists rpc_aprobar_oc_siigo(bigint);
