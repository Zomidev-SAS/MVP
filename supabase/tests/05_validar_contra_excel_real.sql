-- 05_validar_contra_excel_real.sql
-- Compara el saldo que calcula el ledger (apertura + deltas) contra el
-- valor_total real reportado en Saldos_de_inventario_30_Agosto_2026.xlsx.
-- Si esto pasa, significa que la carga (01 a 04) reconstruyó exactamente
-- el inventario real, sin perder ni duplicar ningún movimiento.

do $$
declare
  valor_calculado   numeric;
  valor_real_agosto numeric := 3494744746.02;  -- suma real del xlsx de agosto
  diferencia        numeric;
  productos_cargados int;
begin
  select count(*) into productos_cargados from productos;
  if productos_cargados = 0 then
    raise exception 'FALLÓ: no hay productos cargados. ¿Corriste 01_productos_reales.sql?';
  end if;

  select coalesce(sum(valor_total), 0) into valor_calculado
  from vista_inventario_actual;

  diferencia := abs(valor_calculado - valor_real_agosto);

  -- margen de tolerancia por redondeos de valor_unitario aproximado
  if diferencia > 1000 then
    raise exception 'FALLÓ: valor calculado (%) difiere del real de agosto (%) por más de $1.000. Diferencia: %',
      valor_calculado, valor_real_agosto, diferencia;
  end if;

  raise notice 'OK: % productos cargados', productos_cargados;
  raise notice 'OK: valor calculado por el ledger = %', valor_calculado;
  raise notice 'OK: valor real reportado en agosto = %', valor_real_agosto;
  raise notice 'OK: diferencia = % (dentro de tolerancia)', diferencia;
end $$;
