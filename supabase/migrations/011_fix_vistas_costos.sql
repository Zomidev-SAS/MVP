-- 011_fix_vistas_costos.sql
-- Corrige el conflicto de 009/010: security_invoker=true + REVOKE de columna
-- + CASE WHEN es incompatible en Postgres (revisa permisos sobre el TEXTO
-- de la consulta, no sobre el resultado). Por eso quedó bloqueada para todos.
--
-- Solución: las vistas vuelven a ejecutarse con los permisos del DUEÑO
-- (comportamiento por defecto, sin security_invoker) — así, aunque la tabla
-- base tenga revocada la columna valor_unitario para 'authenticated', la
-- vista puede seguir leyéndola porque corre como su dueño (postgres), y
-- el CASE WHEN sigue enmascarando el valor según el rol REAL de quien
-- consulta (get_user_rol() usa auth.uid(), no depende de quién sea el dueño).
--
-- Con esto, el REVOKE de columna sí cumple su función: bloquea el acceso
-- DIRECTO a movimientos_inventario (saltándose la vista), sin romper la vista.

drop view if exists vista_movimientos_recientes;
drop view if exists vista_valorizacion_basica;
drop view if exists vista_inventario_actual;

create view vista_inventario_actual as
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

create view vista_valorizacion_basica as
select
  coalesce(categoria, 'Sin categoría') as categoria,
  sum(saldo) as unidades,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then sum(valor_total)
       else null
  end as valor_total
from vista_inventario_actual
group by categoria;

create view vista_movimientos_recientes as
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

-- Al recrear las vistas (DROP+CREATE), quedan sin permisos: re-otorgar.
grant select on
  vista_inventario_actual,
  vista_valorizacion_basica,
  vista_movimientos_recientes,
  vista_inventario_por_bodega
to authenticated;