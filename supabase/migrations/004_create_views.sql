create view vista_inventario_actual as
select
  vin,
  max(marca) as marca,
  max(categoria) as categoria,
  max(ubicacion) as ubicacion,
  sum(cantidad) as saldo,
  max(valor_unitario) as valor_unitario,
  sum(cantidad) * max(coalesce(valor_unitario, 0)) as valor_total,
  max(created_at) as ultimo_movimiento
from movimientos_inventario
where estado = 'aplicado'
group by vin;

create view vista_valorizacion_basica as
select
  coalesce(categoria, 'Sin categoría') as categoria,
  coalesce(marca, 'Sin marca') as marca,
  sum(saldo) as unidades,
  sum(valor_total) as valor_total
from vista_inventario_actual
group by categoria, marca;

create view vista_movimientos_recientes as
select m.*, p.nombre as actor_nombre, p.rol as actor_rol
from movimientos_inventario m
left join profiles p on m.actor_id = p.id
order by m.created_at desc
limit 100;