-- 016_rpc_aprobar_ajuste.sql
-- B7: aprobar o rechazar un ajuste de forma atómica.
-- Si se aprueba: inserta el movimiento real Y actualiza el ajuste, en una
-- sola transacción (todo o nada). Si se rechaza: solo actualiza el estado.

create or replace function resolver_ajuste(
  p_ajuste_id bigint,
  p_decision text,
  p_motivo_rechazo text default null
)
returns table (ajuste_id bigint, estado_final text, movimiento_id bigint)
language plpgsql
security definer
as $$
declare
  v_ajuste ajustes_pendientes%rowtype;
  v_borrador jsonb;
  v_movimiento_id bigint;
begin
  if p_decision not in ('aprobado', 'rechazado') then
    raise exception 'decision debe ser "aprobado" o "rechazado", recibido: %', p_decision;
  end if;

  -- Solo supervisor puede resolver (doble candado: esto + la policy de RLS)
  if get_user_rol() is distinct from 'supervisor' then
    raise exception 'Solo un supervisor puede resolver ajustes';
  end if;

  select * into v_ajuste from ajustes_pendientes where id = p_ajuste_id for update;

  if not found then
    raise exception 'Ajuste % no existe', p_ajuste_id;
  end if;

  if v_ajuste.estado != 'pendiente' then
    raise exception 'El ajuste % ya fue resuelto (estado: %)', p_ajuste_id, v_ajuste.estado;
  end if;

  if p_decision = 'rechazado' then
    update ajustes_pendientes
    set estado = 'rechazado',
        motivo_rechazo = p_motivo_rechazo,
        resuelto_por = auth.uid(),
        resuelto_at = now()
    where id = p_ajuste_id;

    return query select p_ajuste_id, 'rechazado'::text, null::bigint;
    return;
  end if;

  -- decision = 'aprobado': insertar el movimiento real desde el borrador
  v_borrador := v_ajuste.movimiento_borrador;

  insert into movimientos_inventario (
    codigo_producto, tipo_movimiento, cantidad, valor_unitario,
    bodega, motivo, actor_id, aprobado_por, idempotency_key
  )
  values (
    v_borrador ->> 'codigo_producto',
    'ajuste',
    (v_borrador ->> 'cantidad')::numeric,
    nullif(v_borrador ->> 'valor_unitario', '')::numeric,
    v_borrador ->> 'bodega',
    coalesce(v_borrador ->> 'motivo', 'Ajuste aprobado #' || p_ajuste_id),
    v_ajuste.solicitado_por,
    auth.uid(),
    'ajuste-aprobado-' || p_ajuste_id
  )
  returning id into v_movimiento_id;

  update ajustes_pendientes
  set estado = 'aprobado',
      resuelto_por = auth.uid(),
      resuelto_at = now()
  where id = p_ajuste_id;

  return query select p_ajuste_id, 'aprobado'::text, v_movimiento_id;
end;
$$;

grant execute on function resolver_ajuste(bigint, text, text) to authenticated;