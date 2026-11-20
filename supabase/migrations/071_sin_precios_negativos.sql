-- 071: ningún precio negativo llega al panel.
--
-- Un precio negativo (de Siigo o de un movimiento antiguo) hacía que el valor
-- unitario y el valor total salieran en negativo. Ahora:
--   * se limpian los precios negativos guardados desde Siigo;
--   * las vistas ignoran cualquier valor_unitario negativo (usan el precio de
--     Siigo si es válido y, si no, el mayor precio positivo de los movimientos);
--   * si no hay ningún precio válido, el valor unitario queda vacío y el total en 0.
-- Mismas columnas que 069; solo cambia cómo se calcula el precio.

update productos set siigo_precio = null where siigo_precio < 0;

create or replace view vista_inventario_actual as
select
  m.codigo_producto,
  p.nombre_producto,
  p.unidad_medida,
  p.categoria,
  sum(m.cantidad) as saldo,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then coalesce(
              case when p.siigo_precio >= 0 then p.siigo_precio end,
              max(case when m.valor_unitario >= 0 then m.valor_unitario end))
       else null
  end as valor_unitario,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then greatest(sum(m.cantidad), 0) * coalesce(
              case when p.siigo_precio >= 0 then p.siigo_precio end,
              max(case when m.valor_unitario >= 0 then m.valor_unitario end),
              0)
       else null
  end as valor_total,
  max(m.created_at) as ultimo_movimiento
from movimientos_inventario m
join productos p on p.codigo_producto = m.codigo_producto
where m.estado = 'aplicado' and p.categoria is not null
group by m.codigo_producto, p.nombre_producto, p.unidad_medida, p.categoria, p.siigo_precio;

create or replace view vista_inventario_por_bodega as
select
  m.codigo_producto,
  p.nombre_producto,
  p.unidad_medida,
  p.categoria,
  m.bodega,
  sum(m.cantidad) as saldo,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then coalesce(
              case when p.siigo_precio >= 0 then p.siigo_precio end,
              max(case when m.valor_unitario >= 0 then m.valor_unitario end))
       else null
  end as valor_unitario,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then greatest(sum(m.cantidad), 0) * coalesce(
              case when p.siigo_precio >= 0 then p.siigo_precio end,
              max(case when m.valor_unitario >= 0 then m.valor_unitario end),
              0)
       else null
  end as valor_total,
  max(m.created_at) as ultimo_movimiento
from movimientos_inventario m
join productos p on p.codigo_producto = m.codigo_producto
where m.estado = 'aplicado' and p.categoria is not null
group by m.codigo_producto, p.nombre_producto, p.unidad_medida, p.categoria, m.bodega, p.siigo_precio;
