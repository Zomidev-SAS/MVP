-- 070: corrige los saldos negativos por bodega que dejó la primera sincronización
-- con Siigo (069), que mandaba todo el ajuste a 'Sin Asignar'.
--
-- Para cada producto con una bodega en negativo y otras con saldo positivo se
-- mueve la diferencia (par de movimientos de ajuste: -X en la bodega con stock,
-- +X en la negativa). El total del producto NO cambia: sigue igual a Siigo.
-- Si no alcanza el stock de las demás bodegas, queda negativo lo que Siigo tenga negativo.

create or replace function fn_rebalancear_bodegas_negativas()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  neg      record;
  src      record;
  v_falta  numeric;
  v_toma   numeric;
  v_actor  uuid;
  v_movs   int := 0;
  v_hoy    text := to_char((now() at time zone 'America/Bogota')::date, 'YYYY-MM-DD');
begin
  select actor_id into v_actor
  from movimientos_inventario
  where motivo like 'Sincronización con Siigo%'
  limit 1;
  if v_actor is null then
    return 0;
  end if;

  for neg in
    select codigo_producto, bodega, -sum(cantidad) as deficit
    from movimientos_inventario
    where estado = 'aplicado'
    group by codigo_producto, bodega
    having sum(cantidad) < 0
  loop
    v_falta := neg.deficit;
    for src in
      select bodega, sum(cantidad) as saldo
      from movimientos_inventario
      where codigo_producto = neg.codigo_producto and estado = 'aplicado' and bodega <> neg.bodega
      group by bodega
      having sum(cantidad) > 0
      order by sum(cantidad) desc
    loop
      exit when v_falta <= 0;
      v_toma := least(src.saldo, v_falta);
      insert into movimientos_inventario (codigo_producto, tipo_movimiento, cantidad, bodega, motivo, actor_id, idempotency_key)
      values
        (neg.codigo_producto, 'ajuste', -v_toma, src.bodega,
         'Reubicación entre bodegas tras sincronización con Siigo', v_actor,
         'siigo-rebal-' || v_hoy || '-' || md5(neg.codigo_producto || src.bodega || 'o' || clock_timestamp()::text)),
        (neg.codigo_producto, 'ajuste', v_toma, neg.bodega,
         'Reubicación entre bodegas tras sincronización con Siigo', v_actor,
         'siigo-rebal-' || v_hoy || '-' || md5(neg.codigo_producto || neg.bodega || 'd' || clock_timestamp()::text));
      v_falta := v_falta - v_toma;
      v_movs := v_movs + 2;
    end loop;
  end loop;

  return v_movs;
end;
$$;

revoke all on function fn_rebalancear_bodegas_negativas() from public, anon, authenticated;
grant execute on function fn_rebalancear_bodegas_negativas() to service_role;

-- Aplica la corrección ahora (el SQL Editor corre como postgres).
select fn_rebalancear_bodegas_negativas() as movimientos_creados;
