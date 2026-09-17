insert into movimientos_inventario (codigo_producto, tipo_movimiento, cantidad, bodega, actor_id, idempotency_key)
values ('16072000', 'entrada', 1, 'ALMACEN NIVEL 2', '11111111-1111-1111-1111-111111111111', 'clave-duplicada-test');

do $$
begin
  insert into movimientos_inventario (codigo_producto, tipo_movimiento, cantidad, bodega, actor_id, idempotency_key)
  values ('16072000', 'entrada', 1, 'ALMACEN NIVEL 2', '11111111-1111-1111-1111-111111111111', 'clave-duplicada-test');

  raise exception 'FALLÓ: se insertó un segundo movimiento con la misma idempotency_key';
exception
  when unique_violation then
    raise notice 'OK: la constraint UNIQUE rechazó la idempotency_key duplicada, como se esperaba';
end $$;