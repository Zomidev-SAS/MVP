-- Órdenes de compra multi-línea (sección Compras / pedidos Siigo)

create table if not exists orden_compra_items (
  id bigint generated always as identity primary key,
  orden_id bigint not null references ordenes_compra(id) on delete cascade,
  codigo_producto text not null,
  nombre_producto text,
  cantidad numeric not null check (cantidad > 0),
  cantidad_recibida numeric check (cantidad_recibida is null or cantidad_recibida >= 0),
  descripcion text not null check (length(trim(descripcion)) >= 1),
  proveedor_nit text,
  proveedor_nombre text,
  proveedor_email text,
  observaciones text,
  orden_linea smallint not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_orden_compra_items_orden on orden_compra_items(orden_id);
create index if not exists idx_orden_compra_items_producto on orden_compra_items(codigo_producto);

alter table ordenes_compra
  add column if not exists titulo text,
  add column if not exists fecha_vencimiento date,
  add column if not exists observaciones_entrega text;

-- Migrar filas existentes (una línea por orden legacy)
insert into orden_compra_items (
  orden_id,
  codigo_producto,
  nombre_producto,
  cantidad,
  descripcion,
  proveedor_nit,
  proveedor_nombre,
  proveedor_email,
  observaciones,
  orden_linea
)
select
  id,
  codigo_producto,
  nombre_producto,
  cantidad,
  descripcion,
  proveedor_nit,
  proveedor_nombre,
  proveedor_email,
  observaciones,
  1
from ordenes_compra o
where not exists (
  select 1 from orden_compra_items i where i.orden_id = o.id
);

-- Título automático para órdenes legacy
update ordenes_compra o
set titulo = coalesce(
  nullif(trim(o.titulo), ''),
  trim(
    coalesce(o.proveedor_nombre, 'Pedido') || ' OC ' || o.id::text
  )
)
where titulo is null or trim(titulo) = '';

-- Nuevos estados operativos (en curso / listo)
alter table ordenes_compra drop constraint if exists ordenes_compra_estado_check;

update ordenes_compra
set estado = case estado
  when 'finalizada' then 'listo'
  when 'cancelada' then 'cancelada'
  else 'en_curso'
end;

alter table ordenes_compra
  add constraint ordenes_compra_estado_check
  check (estado in ('en_curso', 'listo', 'cancelada'));

-- Campos legacy opcionales (datos viven en orden_compra_items)
alter table ordenes_compra alter column codigo_producto drop not null;
alter table ordenes_compra alter column cantidad drop not null;
alter table ordenes_compra alter column descripcion drop not null;

alter table orden_compra_items enable row level security;

drop policy if exists orden_compra_items_select on orden_compra_items;
create policy orden_compra_items_select on orden_compra_items
  for select using (get_user_rol() is not null);

drop policy if exists orden_compra_items_insert on orden_compra_items;
create policy orden_compra_items_insert on orden_compra_items
  for insert with check (
    get_user_rol() in ('supervisor', 'compras', 'produccion', 'metalmecanica', 'instalacion')
  );

drop policy if exists orden_compra_items_update on orden_compra_items;
create policy orden_compra_items_update on orden_compra_items
  for update using (
    get_user_rol() in ('supervisor', 'compras')
    or exists (
      select 1 from ordenes_compra o
      where o.id = orden_id
        and o.creado_por = auth.uid()
        and o.estado = 'en_curso'
    )
  );

drop policy if exists orden_compra_items_delete on orden_compra_items;
create policy orden_compra_items_delete on orden_compra_items
  for delete using (
    get_user_rol() in ('supervisor', 'compras')
    or exists (
      select 1 from ordenes_compra o
      where o.id = orden_id
        and o.creado_por = auth.uid()
        and o.estado = 'en_curso'
    )
  );

grant select, insert, update, delete on orden_compra_items to authenticated;

create index if not exists idx_ordenes_compra_vencimiento on ordenes_compra(fecha_vencimiento desc nulls last);
