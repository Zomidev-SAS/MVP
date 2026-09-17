-- 009_rls_costos_vistas_seguras.sql
-- B3: oculta valor_unitario y valor_total a roles sin permiso de costos.
-- También corrige un problema real: las vistas creadas en 004/007 no tenían
-- security_invoker, así que corrían con permisos del dueño (postgres) y
-- SALTABAN el RLS de movimientos_inventario por completo. Se corrige aquí.

-- Roles que SÍ pueden ver valor_unitario / valor_total.
-- (Pendiente confirmar esta matriz con el cliente, tal como pide B3.)
-- Por ahora: supervisor, compras, auditoria. Todos los demás ven NULL.

drop view if exists vista_movimientos_recientes;
drop view if exists vista_valorizacion_basica;
drop view if exists vista_inventario_actual;

create view vista_inventario_actual
with (security_invoker = true) as
select
  m.codigo_producto,
  p.nombre_producto,
  p.unidad_medida,
  p.categoria,
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
group by m.codigo_producto, p.nombre_producto, p.unidad_medida, p.categoria;

create view vista_valorizacion_basica
with (security_invoker = true) as
select
  coalesce(categoria, 'Sin categoría') as categoria,
  sum(saldo) as unidades,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then sum(valor_total)
       else null
  end as valor_total
from vista_inventario_actual
group by categoria;

create view vista_movimientos_recientes
with (security_invoker = true) as
select
  m.id, m.codigo_producto, m.tipo_movimiento, m.cantidad,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then m.valor_unitario else null
  end as valor_unitario,
  m.bodega, m.formulario_id, m.motivo, m.evidencia,
  m.actor_id, m.aprobado_por, m.estado, m.idempotency_key, m.created_at,
  pr.nombre         as actor_nombre,
  pr.rol            as actor_rol,
  p.nombre_producto as producto_nombre
from movimientos_inventario m
left join profiles  pr on m.actor_id = pr.id
left join productos p  on p.codigo_producto = m.codigo_producto
order by m.created_at desc
limit 100;

-- Defensa adicional: bloquear consulta directa de las columnas de costo
-- en la tabla base, para que nadie las lea saltándose las vistas.
revoke select (valor_unitario) on movimientos_inventario from authenticated;

grant select (
  id, codigo_producto, tipo_movimiento, cantidad, marca, categoria,
  ubicacion, bodega, formulario_id, motivo, evidencia,
  actor_id, aprobado_por, estado, idempotency_key, created_at
) on movimientos_inventario to authenticated;