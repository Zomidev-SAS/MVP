-- Órdenes de compra por producto (fuente operativa; export manual a Siigo Nube)

create table if not exists ordenes_compra (
  id bigint generated always as identity primary key,
  codigo_producto text not null,
  nombre_producto text,
  fecha_pedido date not null,
  cantidad numeric not null check (cantidad > 0),
  descripcion text not null check (length(trim(descripcion)) >= 1),
  proveedor_nit text,
  proveedor_nombre text,
  proveedor_email text,
  destino_envio text not null default 'compras'
    check (destino_envio in ('compras', 'proveedor', 'ambos')),
  estado text not null default 'borrador'
    check (estado in ('borrador', 'enviada', 'finalizada', 'cancelada')),
  observaciones text,
  creado_por uuid not null references auth.users(id),
  enviado_a_compras_at timestamptz,
  enviado_a_proveedor_at timestamptz,
  descargada_siigo_at timestamptz,
  finalizada_at timestamptz,
  siigo_referencia text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ordenes_compra_producto on ordenes_compra(codigo_producto);
create index if not exists idx_ordenes_compra_estado on ordenes_compra(estado);
create index if not exists idx_ordenes_compra_fecha on ordenes_compra(fecha_pedido desc);

alter table ordenes_compra enable row level security;

drop policy if exists ordenes_compra_select on ordenes_compra;
create policy ordenes_compra_select on ordenes_compra
  for select using (get_user_rol() is not null);

drop policy if exists ordenes_compra_insert on ordenes_compra;
create policy ordenes_compra_insert on ordenes_compra
  for insert with check (
    creado_por = auth.uid()
    and get_user_rol() in ('supervisor', 'compras', 'produccion', 'metalmecanica', 'instalacion')
  );

drop policy if exists ordenes_compra_update on ordenes_compra;
create policy ordenes_compra_update on ordenes_compra
  for update using (
    get_user_rol() in ('supervisor', 'compras')
    or (creado_por = auth.uid() and estado in ('borrador', 'enviada'))
  );

drop policy if exists ordenes_compra_delete on ordenes_compra;
create policy ordenes_compra_delete on ordenes_compra
  for delete using (
    estado = 'borrador'
    and (creado_por = auth.uid() or get_user_rol() = 'supervisor')
  );

grant select, insert, update, delete on ordenes_compra to authenticated;
