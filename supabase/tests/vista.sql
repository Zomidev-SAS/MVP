do $$
declare
  filas_actual   int;
  filas_valor    int;
  filas_recientes int;
  saldo_manual   numeric;
  saldo_vista    numeric;
begin
  select count(*) into filas_actual   from vista_inventario_actual;
  select count(*) into filas_valor    from vista_valorizacion_basica;
  select count(*) into filas_recientes from vista_movimientos_recientes;

  if filas_actual = 0 then
    raise exception 'FALLÓ: vista_inventario_actual no devuelve filas (¿corriste seed.sql?)';
  end if;

  select sum(cantidad) into saldo_manual
  from movimientos_inventario
  where vin = 'VIN000002' and estado = 'aplicado';

  select saldo into saldo_vista
  from vista_inventario_actual
  where vin = 'VIN000002';

  if saldo_manual is distinct from saldo_vista then
    raise exception 'FALLÓ: saldo de la vista (%) no coincide con SUM manual (%)', saldo_vista, saldo_manual;
  end if;

  raise notice 'OK: vista_inventario_actual = % filas, saldo VIN000002 = % (coincide)', filas_actual, saldo_vista;
  raise notice 'OK: vista_valorizacion_basica = % filas', filas_valor;
  raise notice 'OK: vista_movimientos_recientes = % filas (máx 100)', filas_recientes;
end $$;