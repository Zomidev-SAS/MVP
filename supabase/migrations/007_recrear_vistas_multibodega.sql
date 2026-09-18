drop view if exists vista_movimientos_recientes;
drop view if exists vista_valorizacion_basica;
drop view if exists vista_inventario_actual;

create view vista_inventario_por_bodega as
select
  codigo_producto,
  bodega,
  sum(cantidad)                                    as saldo,
  max(valor_unitario)                              as valor_unitario,
  sum(cantidad) * max(coalesce(valor_unitario, 0)) as valor_total,
  max(created_at)                                  as ultimo_movimiento
from movimientos_inventario
where estado = 'aplicado'
group by codigo_producto, bodega;

create view vista_inventario_actual as
select
  m.codigo_producto,
  p.nombre_producto,
  p.unidad_medida,
  p.categoria,
  sum(m.cantidad)                                    as saldo,
  max(m.valor_unitario)                              as valor_unitario,
  sum(m.cantidad) * max(coalesce(m.valor_unitario, 0)) as valor_total,
  max(m.created_at)                                  as ultimo_movimiento
from movimientos_inventario m
join productos p on p.codigo_producto = m.codigo_producto
where m.estado = 'aplicado'
group by m.codigo_producto, p.nombre_producto, p.unidad_medida, p.categoria;

create view vista_valorizacion_basica as
select
  coalesce(categoria, 'Sin categoría') as categoria,
  sum(saldo)      as unidades,
  sum(valor_total) as valor_total
from vista_inventario_actual
group by categoria;

create view vista_movimientos_recientes as
select
  m.*,
  pr.nombre         as actor_nombre,
  pr.rol            as actor_rol,
  p.nombre_producto as producto_nombre
from movimientos_inventario m
left join profiles  pr on m.actor_id = pr.id
left join productos p  on p.codigo_producto = m.codigo_producto
order by m.created_at desc
limit 100;