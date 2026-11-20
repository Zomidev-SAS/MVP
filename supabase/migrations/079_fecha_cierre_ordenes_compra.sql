-- 079: fecha de cierre de cada orden de compra.
--
-- ordenes_compra.fecha_cierre es una fecha que compras/supervisor pueden escribir o elegir
-- (también antes de cerrar la orden). Si una orden se cierra sin fecha de cierre, se llena
-- sola con el día de hoy (hora de Bogotá); si se reabre, se borra.
-- Las órdenes ya cerradas reciben la fecha en que se finalizaron.
-- La TV de compras usa esta fecha para las órdenes finalizadas.

begin;

alter table ordenes_compra add column if not exists fecha_cierre date;

update ordenes_compra
set fecha_cierre = (coalesce(finalizada_at, updated_at) at time zone 'America/Bogota')::date
where estado = 'listo' and fecha_cierre is null;

create or replace function fn_oc_fecha_cierre()
returns trigger
language plpgsql
as $$
begin
  if NEW.estado = 'listo' and OLD.estado is distinct from 'listo' and NEW.fecha_cierre is null then
    NEW.fecha_cierre := (now() at time zone 'America/Bogota')::date;
  elsif NEW.estado = 'en_curso' and OLD.estado = 'listo' and NEW.fecha_cierre is not distinct from OLD.fecha_cierre then
    -- Reabierta: la orden ya no está cerrada, se quita la fecha automática.
    NEW.fecha_cierre := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_oc_fecha_cierre on ordenes_compra;
create trigger trg_oc_fecha_cierre
  before update of estado on ordenes_compra
  for each row
  execute function fn_oc_fecha_cierre();

-- ===================== TV de compras: finalizadas por fecha de cierre =====================
create or replace function rpc_planta_compras(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
begin
  if not fn_verificar_token_planta_tipo(p_token, 'planta-compras') then
    raise exception 'Token de planta (compras) inválido o vencido' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'kpis', jsonb_build_object(
      'en_curso', (select count(*) from ordenes_compra where estado = 'en_curso'),
      'finalizadas_30d', (select count(*) from ordenes_compra
                          where estado = 'listo'
                            and coalesce(fecha_cierre::timestamp at time zone 'America/Bogota', finalizada_at, updated_at)
                                >= now() - interval '30 days'),
      'pendientes_firma', (select count(*) from ordenes_compra
                           where estado = 'en_curso' and documento_path is not null and firmada_at is null),
      'con_entregas_parciales', (
        select count(*) from ordenes_compra o
        where o.estado = 'en_curso'
          and exists (
            select 1 from orden_compra_items i
            where i.orden_id = o.id
              and coalesce(i.cantidad_recibida, 0) > 0
              and i.cantidad_recibida < i.cantidad
          )
      )
    ),

    'ordenes', coalesce((
      select jsonb_agg(t.fila order by t.vence nulls last, t.id)
      from (
        select
          o.id,
          o.fecha_vencimiento as vence,
          jsonb_build_object(
            'id', o.id,
            'numero', o.numero_oc,
            'titulo', o.titulo,
            'proveedor', (select min(i.proveedor_nombre) from orden_compra_items i where i.orden_id = o.id),
            'fecha_pedido', o.fecha_pedido,
            'fecha_vencimiento', o.fecha_vencimiento,
            'requiere_firma', o.documento_path is not null,
            'firmada', o.firmada_at is not null,
            'pedidas', coalesce((select sum(i.cantidad) from orden_compra_items i where i.orden_id = o.id), 0),
            'recibidas', coalesce((select sum(coalesce(i.cantidad_recibida, 0)) from orden_compra_items i where i.orden_id = o.id), 0),
            'ultima_entrega', (select max(i.cantidad_recibida_at) from orden_compra_items i where i.orden_id = o.id),
            'observaciones', o.observaciones,
            'items', coalesce((
              select jsonb_agg(jsonb_build_object(
                       'codigo_producto', i.codigo_producto,
                       'nombre_producto', i.nombre_producto,
                       'descripcion', i.descripcion,
                       'cantidad', i.cantidad,
                       'cantidad_recibida', coalesce(i.cantidad_recibida, 0),
                       'proveedor_nombre', i.proveedor_nombre,
                       'observaciones', i.observaciones
                     ) order by i.orden_linea, i.id)
              from orden_compra_items i where i.orden_id = o.id
            ), '[]'::jsonb)
          ) as fila
        from ordenes_compra o
        where o.estado = 'en_curso'
        order by o.fecha_vencimiento nulls last, o.id
        limit 24
      ) t
    ), '[]'::jsonb),

    'finalizadas', coalesce((
      select jsonb_agg(f.fila order by f.fin desc, f.id desc)
      from (
        select
          o.id,
          coalesce(o.fecha_cierre::timestamp at time zone 'America/Bogota', o.finalizada_at, o.updated_at) as fin,
          jsonb_build_object(
            'id', o.id,
            'numero', o.numero_oc,
            'titulo', o.titulo,
            'proveedor', (select min(i.proveedor_nombre) from orden_compra_items i where i.orden_id = o.id),
            'finalizada_at', coalesce(o.finalizada_at, o.updated_at),
            'fecha_cierre', o.fecha_cierre,
            'pedidas', coalesce((select sum(i.cantidad) from orden_compra_items i where i.orden_id = o.id), 0),
            'recibidas', coalesce((select sum(coalesce(i.cantidad_recibida, 0)) from orden_compra_items i where i.orden_id = o.id), 0),
            'lineas', (select count(*) from orden_compra_items i where i.orden_id = o.id)
          ) as fila
        from ordenes_compra o
        where o.estado = 'listo'
        order by coalesce(o.fecha_cierre::timestamp at time zone 'America/Bogota', o.finalizada_at, o.updated_at) desc, o.id desc
        limit 12
      ) f
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function rpc_planta_compras(text) from public;
grant execute on function rpc_planta_compras(text) to anon, authenticated, service_role;

commit;
