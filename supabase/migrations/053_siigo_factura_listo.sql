-- Ajuste del flujo Siigo basado en confirmación de contabilidad:
--
-- 1. Momento de creación: cuando llega la factura del proveedor (estado='listo'),
--    no al aprobar la OC.
-- 2. Tipo de documento: Factura de compra (FC) — usar el ID correcto del tipo
--    de documento en el Vault: supabase secrets set SIIGO_DOCUMENT_TYPE_ID=<id>
-- 3. Medios de pago soportados: crédito y contado. Si se configuran los
--    secretos SIIGO_PAYMENT_TYPE_ID_CREDITO y/o SIIGO_PAYMENT_TYPE_ID_CONTADO,
--    la Edge Function los incluye en el documento. De lo contrario, Siigo usa
--    su propio valor por defecto.
-- 4. Precio: los ítems se envían sin precio (price=0); el ajuste de costo real
--    se hace en Siigo directamente.

-- 1. Columna medio de pago
alter table ordenes_compra
  add column if not exists medio_pago text
  check (medio_pago in ('credito', 'contado'));

-- 2. Columnas Siigo (por si no existen — pueden venir de 039_kpi_diario.sql)
alter table ordenes_compra
  add column if not exists siigo_id      text,
  add column if not exists siigo_estado  text
    check (siigo_estado in ('pendiente', 'enviando', 'sincronizada', 'error'));

-- 3. RPC que combina marcar-como-listo + disparar Siigo
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

  -- Idempotencia: si ya fue sincronizada, no reenviar
  if v_orden.siigo_id is not null then
    return jsonb_build_object('ok', true, 'ya_sincronizada', true, 'siigo_id', v_orden.siigo_id);
  end if;

  -- Disparar sincronización con Siigo (asíncrona vía pg_net)
  perform fn_llamar_edge_function(
    'siigo-sync-oc',
    jsonb_build_object('orden_id', p_orden_id)
  );

  return jsonb_build_object('ok', true, 'ya_sincronizada', false);
end;
$$;

grant execute on function rpc_marcar_oc_listo(bigint, text) to authenticated;
