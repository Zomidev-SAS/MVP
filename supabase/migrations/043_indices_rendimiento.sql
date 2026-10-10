-- B10: Índices de rendimiento para lo que consultan las gráficas del
-- dashboard (B6) que no quedó cubierto al crear cada tabla.

create index if not exists idx_ajustes_pendientes_estado_fecha
  on ajustes_pendientes(estado, created_at desc);
create index if not exists idx_ajustes_pendientes_resuelto_fecha
  on ajustes_pendientes(resuelto_at desc) where resuelto_at is not null;

create index if not exists idx_vehiculo_procesos_chasis_fecha
  on vehiculo_procesos(chasis, creado_en desc);

create index if not exists idx_productos_categoria on productos(categoria);

-- movimientos_inventario ya tiene idx_mov_estado_fecha (002) e
-- idx_mov_codigo_producto / idx_mov_bodega (006/007); se agrega el
-- compuesto que realmente usan las vistas de B6 (filtran por estado y
-- agrupan por fecha+tipo).
create index if not exists idx_mov_estado_tipo_fecha
  on movimientos_inventario(estado, tipo_movimiento, created_at desc);

-- ordenes_compra: además de estado/fecha (025) y siigo_estado (039), el
-- aviso de vencidas (B5) filtra por fecha_vencimiento + estado.
create index if not exists idx_ordenes_compra_vencidas
  on ordenes_compra(fecha_vencimiento)
  where estado not in ('listo', 'cancelada') and fecha_vencimiento is not null;

analyze movimientos_inventario;
analyze ordenes_compra;
analyze ajustes_pendientes;
analyze vehiculo_procesos;
analyze notificaciones;
