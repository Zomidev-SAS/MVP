-- 05_validar_contra_excel_real.sql
-- Compara el saldo que calcula el ledger (apertura + deltas, YA FILTRADOS)
-- contra el valor_total real de agosto, recalculado solo sobre los 475
-- productos que pasan los 3 filtros de negocio (código numérico puro, sin
-- nombre de vehículo, sin categoría genérica "Productos"/"Productos CA").

do $$
declare
  valor_calculado   numeric;
  valor_real_agosto numeric := 791284169.98;  -- recalculado solo con productos filtrados
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

  if diferencia > 1000 then
    raise exception 'FALLÓ: valor calculado (%) difiere del real filtrado de agosto (%) por más de $1.000. Diferencia: %',
      valor_calculado, valor_real_agosto, diferencia;
  end if;

  raise notice 'OK: % productos cargados (filtrados)', productos_cargados;
  raise notice 'OK: valor calculado por el ledger = %', valor_calculado;
  raise notice 'OK: valor real filtrado de agosto = %', valor_real_agosto;
  raise notice 'OK: diferencia = % (dentro de tolerancia)', diferencia;
end $$;
