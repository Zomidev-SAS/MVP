-- 010_grants_authenticated.sql
-- Corrige un permiso faltante: al recrear las vistas en 009 con DROP+CREATE,
-- se perdió el GRANT SELECT que el rol 'authenticated' necesita para poder
-- consultarlas. RLS filtra FILAS, pero primero Postgres exige permiso sobre
-- el objeto mismo (tabla o vista) — son dos capas distintas.

grant usage on schema public to authenticated;

-- Tablas sin restricción de columna
grant select on profiles, productos, bodegas, categorias_inventario, ajustes_pendientes
  to authenticated;

-- movimientos_inventario: mantener oculta la columna valor_unitario (B3)
revoke select (valor_unitario) on movimientos_inventario from authenticated;
grant select (
  id, codigo_producto, tipo_movimiento, cantidad, marca, categoria,
  ubicacion, bodega, formulario_id, motivo, evidencia,
  actor_id, aprobado_por, estado, idempotency_key, created_at
) on movimientos_inventario to authenticated;

-- Permisos de escritura que las políticas de RLS van a filtrar por rol
grant insert on movimientos_inventario to authenticated;
grant insert, update on ajustes_pendientes to authenticated;
grant update on profiles to authenticated;

-- Las 4 vistas: security_invoker=true necesita GRANT explícito sobre la vista misma
grant select on
  vista_inventario_actual,
  vista_valorizacion_basica,
  vista_movimientos_recientes,
  vista_inventario_por_bodega
to authenticated;