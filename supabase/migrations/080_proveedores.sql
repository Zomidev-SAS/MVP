-- 080: catálogo de proveedores (sección Proveedores del panel).
--
-- Hasta ahora el proveedor solo existía repetido dentro de cada línea de OC (NIT, nombre, correo).
-- Esta tabla es el catálogo: se siembra con los proveedores ya usados en las OC y se mantiene
-- sola con un trigger cuando se crea una línea con un NIT nuevo. El NIT se compara solo por
-- dígitos (nit_normalizado), así "890.900.123-4" y "8909001234" son el mismo proveedor.
-- Todos los roles de la sección (supervisor, comercial, compras, auditoria) ven y modifican;
-- borrar solo supervisor.
--
-- origen = 'siigo' lo usará la bajada nocturna de Siigo cuando se extienda para guardar todos
-- los proveedores (pendiente de backend).

begin;

create table if not exists proveedores (
  id              bigint generated always as identity primary key,
  nit             text not null check (length(trim(nit)) >= 1),
  nit_normalizado text generated always as (regexp_replace(nit, '\D', '', 'g')) stored,
  nombre          text not null check (length(trim(nombre)) >= 1),
  email           text,
  telefono        text,
  contacto        text,
  notas           text,
  activo          boolean not null default true,
  origen          text not null default 'manual' check (origen in ('manual', 'oc', 'importado', 'siigo')),
  creado_por      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint proveedores_nit_con_numeros check (regexp_replace(nit, '\D', '', 'g') <> '')
);

create unique index if not exists uq_proveedores_nit_normalizado on proveedores (nit_normalizado);
create index if not exists idx_proveedores_nombre on proveedores (lower(nombre));

-- El NIT normalizado de las líneas de OC permite consultar el historial de un proveedor con índice.
alter table orden_compra_items
  add column if not exists proveedor_nit_normalizado text
  generated always as (nullif(regexp_replace(coalesce(proveedor_nit, ''), '\D', '', 'g'), '')) stored;

create index if not exists idx_oc_items_nit_normalizado on orden_compra_items (proveedor_nit_normalizado);

-- Siembra: un proveedor por NIT, con el nombre y correo de la línea más reciente.
insert into proveedores (nit, nombre, email, origen)
select distinct on (regexp_replace(i.proveedor_nit, '\D', '', 'g'))
  trim(i.proveedor_nit),
  coalesce(nullif(trim(i.proveedor_nombre), ''), trim(i.proveedor_nit)),
  nullif(trim(i.proveedor_email), ''),
  'oc'
from orden_compra_items i
where i.proveedor_nit is not null
  and regexp_replace(i.proveedor_nit, '\D', '', 'g') <> ''
order by regexp_replace(i.proveedor_nit, '\D', '', 'g'), i.id desc
on conflict do nothing;

-- Mantiene el catálogo al día cuando llega una línea de OC con un proveedor nuevo.
create or replace function fn_oc_item_sync_proveedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.proveedor_nit is not null and regexp_replace(new.proveedor_nit, '\D', '', 'g') <> '' then
    insert into proveedores (nit, nombre, email, origen)
    values (
      trim(new.proveedor_nit),
      coalesce(nullif(trim(new.proveedor_nombre), ''), trim(new.proveedor_nit)),
      nullif(trim(new.proveedor_email), ''),
      'oc'
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_oc_item_sync_proveedor on orden_compra_items;
create trigger trg_oc_item_sync_proveedor
  after insert on orden_compra_items
  for each row execute function fn_oc_item_sync_proveedor();

-- Quién creó el proveedor lo fuerza el servidor, no el cliente.
create or replace function fn_proveedores_set_autor()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.creado_por := coalesce(auth.uid(), new.creado_por);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_proveedores_set_autor on proveedores;
create trigger trg_proveedores_set_autor
  before insert or update on proveedores
  for each row execute function fn_proveedores_set_autor();

alter table proveedores enable row level security;

drop policy if exists proveedores_select on proveedores;
create policy proveedores_select on proveedores
  for select using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedores_insert on proveedores;
create policy proveedores_insert on proveedores
  for insert with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedores_update on proveedores;
create policy proveedores_update on proveedores
  for update
  using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'))
  with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedores_delete on proveedores;
create policy proveedores_delete on proveedores
  for delete using (get_user_rol() = 'supervisor');

revoke all on proveedores from anon;
grant select, insert, update, delete on proveedores to authenticated;
grant all on proveedores to service_role;

commit;
