-- Vista enriquecida para filtrar inventario por bodega desde el panel.
drop view if exists vista_inventario_por_bodega;

create view vista_inventario_por_bodega as
select
  m.codigo_producto,
  p.nombre_producto,
  p.unidad_medida,
  p.categoria,
  m.bodega,
  sum(m.cantidad) as saldo,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then max(m.valor_unitario)
       else null
  end as valor_unitario,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then sum(m.cantidad) * max(coalesce(m.valor_unitario, 0))
       else null
  end as valor_total,
  max(m.created_at) as ultimo_movimiento
from movimientos_inventario m
join productos p on p.codigo_producto = m.codigo_producto
where m.estado = 'aplicado'
group by m.codigo_producto, p.nombre_producto, p.unidad_medida, p.categoria, m.bodega;

grant select on vista_inventario_por_bodega to authenticated;
