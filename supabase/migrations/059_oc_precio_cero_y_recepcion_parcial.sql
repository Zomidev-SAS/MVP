-- 059: correcciones de órdenes de compra.
--
-- 1) Precio unitario 0 permitido (producto de cortesía / sin costo). Antes el
--    CHECK exigía > 0 y rpc_marcar_oc_listo rechazaba precio <= 0. Ahora solo
--    se exige que la línea tenga precio (null = sin precio indicado).
-- 2) Recepciones parciales por número: cantidad_recibida ya existía; se agrega
--    cuándo se actualizó por última vez (cantidad_recibida_at) para mostrar
--    "50 de 100 · restan 50 · actualizado el ...".

alter table orden_compra_items
  drop constraint if exists orden_compra_items_precio_unitario_check;
alter table orden_compra_items
  add constraint orden_compra_items_precio_unitario_check
  check (precio_unitario is null or precio_unitario >= 0);

alter table orden_compra_items
  add column if not exists cantidad_recibida_at timestamptz;

-- Las líneas que ya tienen cantidad recibida conservan una fecha razonable.
update orden_compra_items
set cantidad_recibida_at = created_at
where cantidad_recibida is not null and cantidad_recibida_at is null;

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
    where orden_id = p_orden_id and precio_unitario is null
  ) then
    raise exception 'La orden % tiene líneas sin precio unitario. Edítala y agrega el precio (puede ser 0) antes de marcarla como lista.', p_orden_id;
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
