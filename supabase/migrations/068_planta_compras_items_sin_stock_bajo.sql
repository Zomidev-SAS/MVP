-- Modo planta de compras: cada orden incluye sus líneas (descripción completa,
-- cantidades y observaciones) y se retira el listado de stock bajo.
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
      'vencidas', (select count(*) from ordenes_compra
                   where estado = 'en_curso' and fecha_vencimiento is not null and fecha_vencimiento < v_hoy),
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
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function rpc_planta_compras(text) from public;
grant execute on function rpc_planta_compras(text) to anon, authenticated, service_role;
