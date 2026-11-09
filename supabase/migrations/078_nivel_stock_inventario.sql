-- 078: nivel de stock en las vistas de inventario, para filtrar por Críticos y Bajos.
--
-- Agrega la columna nivel_stock al final de vista_inventario_actual y vista_inventario_por_bodega:
--   'critico' -> saldo en o bajo min(2, umbral del producto)   (rojo en Inventario; incluye agotados)
--   'bajo'    -> saldo en o bajo el umbral del producto        (amarillo en Inventario)
--   'ok'      -> el resto
-- Es el mismo criterio con el que Inventario pinta las filas. Requiere la 075 (umbral por producto y ocultos).

begin;

do $$
declare
  t_unit_actual  text;
  t_total_actual text;
  t_unit_bodega  text;
  t_total_bodega text;
  cuerpo_costos  text := $c$
  fn_valor_unitario_producto(m.codigo_producto)::%1$s as valor_unitario,
  (case when fn_valor_unitario_producto(m.codigo_producto) is null
        then case when get_user_rol() in ('supervisor','compras','auditoria') then 0 else null end
        else greatest(sum(m.cantidad), 0) * fn_valor_unitario_producto(m.codigo_producto)
   end)::%2$s as valor_total,$c$;
begin
  select format_type(a.atttypid, a.atttypmod) into t_unit_actual
    from pg_attribute a where a.attrelid = 'public.vista_inventario_actual'::regclass and a.attname = 'valor_unitario';
  select format_type(a.atttypid, a.atttypmod) into t_total_actual
    from pg_attribute a where a.attrelid = 'public.vista_inventario_actual'::regclass and a.attname = 'valor_total';
  select format_type(a.atttypid, a.atttypmod) into t_unit_bodega
    from pg_attribute a where a.attrelid = 'public.vista_inventario_por_bodega'::regclass and a.attname = 'valor_unitario';
  select format_type(a.atttypid, a.atttypmod) into t_total_bodega
    from pg_attribute a where a.attrelid = 'public.vista_inventario_por_bodega'::regclass and a.attname = 'valor_total';

  -- Mismas columnas y orden que 075; se agrega nivel_stock al final de ambas vistas.
  execute format($v$
    create or replace view public.vista_inventario_actual with (security_invoker = true) as
    select
      m.codigo_producto,
      p.nombre_producto,
      p.unidad_medida,
      p.categoria,
      greatest(sum(m.cantidad), 0) as saldo,
      %s
      max(m.created_at) as ultimo_movimiento,
      fn_umbral_producto(m.codigo_producto) as umbral_stock,
      case
        when greatest(sum(m.cantidad), 0) <= least(2, fn_umbral_producto(m.codigo_producto)) then 'critico'
        when greatest(sum(m.cantidad), 0) <= fn_umbral_producto(m.codigo_producto) then 'bajo'
        else 'ok'
      end as nivel_stock
    from public.movimientos_inventario m
    join public.productos p on p.codigo_producto = m.codigo_producto
    where m.estado = 'aplicado' and p.categoria is not null and not p.oculto
    group by m.codigo_producto, p.nombre_producto, p.unidad_medida, p.categoria
  $v$, format(cuerpo_costos, t_unit_actual, t_total_actual));

  execute format($v$
    create or replace view public.vista_inventario_por_bodega with (security_invoker = true) as
    select
      m.codigo_producto,
      p.nombre_producto,
      p.unidad_medida,
      p.categoria,
      m.bodega,
      greatest(sum(m.cantidad), 0) as saldo,
      %s
      max(m.created_at) as ultimo_movimiento,
      fn_umbral_producto(m.codigo_producto) as umbral_stock,
      case
        when greatest(sum(m.cantidad), 0) <= least(2, fn_umbral_producto(m.codigo_producto)) then 'critico'
        when greatest(sum(m.cantidad), 0) <= fn_umbral_producto(m.codigo_producto) then 'bajo'
        else 'ok'
      end as nivel_stock
    from public.movimientos_inventario m
    join public.productos p on p.codigo_producto = m.codigo_producto
    where m.estado = 'aplicado' and p.categoria is not null and not p.oculto
    group by m.codigo_producto, p.nombre_producto, p.unidad_medida, p.categoria, m.bodega
  $v$, format(cuerpo_costos, t_unit_bodega, t_total_bodega));
end $$;

grant select on public.vista_inventario_actual, public.vista_inventario_por_bodega to authenticated;

commit;
