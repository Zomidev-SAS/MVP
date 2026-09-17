-- 012_bloquear_acceso_directo_costos.sql
-- Cierra el hueco que quedó abierto en 011: cualquier usuario autenticado
-- podía seguir viendo valor_unitario consultando movimientos_inventario
-- DIRECTO (saltándose la vista). Esto revoca la columna a nivel de tabla.
--
-- Por qué esto NO rompe las vistas (a diferencia de 009/010):
-- las vistas de 011 NO tienen security_invoker, así que corren con los
-- permisos del DUEÑO de la vista (postgres), no con los del usuario que
-- consulta. El dueño tiene acceso completo, así que este REVOKE no las afecta.

revoke select (valor_unitario) on movimientos_inventario from authenticated;

grant select (
  id, codigo_producto, tipo_movimiento, cantidad, marca, categoria,
  ubicacion, bodega, formulario_id, motivo, evidencia,
  actor_id, aprobado_por, estado, idempotency_key, created_at
) on movimientos_inventario to authenticated;