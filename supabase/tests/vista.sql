do $$
declare
  filas_actual    int;
  filas_valor     int;
  filas_recientes int;
  filas_bodega    int;
  saldo_manual    numeric;
  saldo_vista     numeric;
begin
  select count(*) into filas_actual    from vista_inventario_actual;
  select count(*) into filas_valor     from vista_valorizacion_basica;
  select count(*) into filas_recientes from vista_movimientos_recientes;
  select count(*) into filas_bodega    from vista_inventario_por_bodega;

  if filas_actual = 0 then
    raise exception 'FALLÓ: vista_inventario_actual no devuelve filas (¿cargaste productos y movimientos reales?)';
  end if;

  select sum(cantidad) into saldo_manual
  from movimientos_inventario
  where codigo_producto = '16072000' and estado = 'aplicado';

  select saldo into saldo_vista
  from vista_inventario_actual
  where codigo_producto = '16072000';

  if saldo_manual is distinct from saldo_vista then
    raise exception 'FALLÓ: saldo de la vista (%) no coincide con SUM manual (%)', saldo_vista, saldo_manual;
  end if;

  raise notice 'OK: vista_inventario_actual = % filas, saldo 16072000 = % (coincide)', filas_actual, saldo_vista;
  raise notice 'OK: vista_valorizacion_basica = % filas', filas_valor;
  raise notice 'OK: vista_movimientos_recientes = % filas (máx 100)', filas_recientes;
  raise notice 'OK: vista_inventario_por_bodega = % filas', filas_bodega;
end $$;