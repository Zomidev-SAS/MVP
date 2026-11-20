-- 060: línea de tiempo de órdenes de compra y limpieza de categorías.
--
-- 1) orden_compra_recepciones: un evento por cada entrega parcial (cuánto llegó,
--    cuánto lleva acumulado y cuándo). Alimenta la línea de tiempo del dashboard
--    "inicio de la OC → entregas parciales → finalización". Antes solo se
--    guardaba el acumulado y la fecha de la última actualización.
-- 2) Se eliminan de categorias_inventario las categorías que no se usan
--    (ningún producto las referencia): CA IMPORTACIONES, Otro CA, Productos,
--    Productos CA y Servicios.

create table if not exists orden_compra_recepciones (
  id              bigint generated always as identity primary key,
  orden_id        bigint not null references ordenes_compra(id) on delete cascade,
  item_id         bigint references orden_compra_items(id) on delete set null,
  codigo_producto text   not null,
  cantidad        numeric not null check (cantidad > 0),
  acumulada       numeric,
  pedida          numeric,
  creado_por      uuid,
  created_at      timestamptz not null default now()
);

create index if not exists idx_oc_recepciones_orden
  on orden_compra_recepciones (orden_id, created_at);

alter table orden_compra_recepciones enable row level security;

drop policy if exists orden_compra_recepciones_select on orden_compra_recepciones;
create policy orden_compra_recepciones_select on orden_compra_recepciones
  for select using (get_user_rol() is not null);

drop policy if exists orden_compra_recepciones_insert on orden_compra_recepciones;
create policy orden_compra_recepciones_insert on orden_compra_recepciones
  for insert with check (
    get_user_rol() in ('supervisor', 'compras', 'produccion', 'metalmecanica', 'instalacion')
  );

revoke all on orden_compra_recepciones from anon;
grant select, insert on orden_compra_recepciones to authenticated;
grant all on orden_compra_recepciones to service_role;

-- Las líneas que ya tenían cantidad recibida arrancan con un evento.
insert into orden_compra_recepciones
  (orden_id, item_id, codigo_producto, cantidad, acumulada, pedida, created_at)
select i.orden_id, i.id, i.codigo_producto, i.cantidad_recibida, i.cantidad_recibida,
       i.cantidad, coalesce(i.cantidad_recibida_at, i.created_at)
from orden_compra_items i
where i.cantidad_recibida is not null
  and i.cantidad_recibida > 0
  and not exists (select 1 from orden_compra_recepciones r where r.item_id = i.id);

delete from categorias_inventario
where nombre in ('CA IMPORTACIONES', 'Otro CA', 'Productos', 'Productos CA', 'Servicios')
  and not exists (
    select 1 from productos p where p.categoria = categorias_inventario.nombre
  );
