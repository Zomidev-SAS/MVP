insert into movimientos_inventario (vin, tipo_movimiento, cantidad, actor_id, idempotency_key)
values ('VINDUPTEST', 'entrada', 1, '11111111-1111-1111-1111-111111111111', 'clave-duplicada-test');

do $$
begin
  insert into movimientos_inventario (vin, tipo_movimiento, cantidad, actor_id, idempotency_key)
  values ('VINDUPTEST', 'entrada', 1, '11111111-1111-1111-1111-111111111111', 'clave-duplicada-test');

  raise exception 'FALLÓ: se insertó un segundo movimiento con la misma idempotency_key';
exception
  when unique_violation then
    raise notice 'OK: la constraint UNIQUE rechazó la idempotency_key duplicada, como se esperaba';
end $$;

