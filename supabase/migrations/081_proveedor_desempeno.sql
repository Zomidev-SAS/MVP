-- 081: desempeño de proveedores por orden de compra + parámetros de evaluación.
--
-- Una fila por (OC, proveedor): se crea sola cuando se crea la línea de la OC ("se genera la OC y
-- se abre su desempeño"). También admite filas históricas importadas (orden_id nulo + numero_oc).
-- Las fechas y cantidades son sobrescrituras: si están en null, el panel las deriva de la OC.
-- Calidad (bien/regular/mal), devoluciones y observaciones son captura manual.

begin;

create table if not exists proveedor_desempeno (
  id                      bigint generated always as identity primary key,
  proveedor_id            bigint not null references proveedores(id) on delete cascade,
  orden_id                bigint references ordenes_compra(id) on delete cascade,
  numero_oc               text,
  fecha_oc                date,
  fecha_entrega_prometida date,
  fecha_entrega_real      date,
  factura_remision        text,
  cantidad_pedida         numeric check (cantidad_pedida is null or cantidad_pedida >= 0),
  cantidad_recibida       numeric check (cantidad_recibida is null or cantidad_recibida >= 0),
  calidad                 text check (calidad is null or calidad in ('bien', 'regular', 'mal')),
  calidad_comentario      text,
  devoluciones            integer not null default 0 check (devoluciones >= 0),
  devoluciones_detalle    text,
  cantidad_observaciones  text,
  pagos_acordados         text,
  tiempo_observaciones    text,
  observaciones           text,
  actualizado_por         uuid references auth.users(id),
  actualizado_por_nombre  text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint desempeno_tiene_origen check (orden_id is not null or numero_oc is not null)
);

create unique index if not exists uq_desempeno_orden_proveedor
  on proveedor_desempeno (orden_id, proveedor_id) where orden_id is not null;
create unique index if not exists uq_desempeno_historico
  on proveedor_desempeno (proveedor_id, lower(numero_oc)) where orden_id is null;
create index if not exists idx_desempeno_proveedor on proveedor_desempeno (proveedor_id);

-- Quién y cuándo lo fuerza el servidor.
create or replace function fn_proveedor_desempeno_autor()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_por := auth.uid();
  new.actualizado_por_nombre := (select nombre from profiles where id = auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_proveedor_desempeno_autor on proveedor_desempeno;
create trigger trg_proveedor_desempeno_autor
  before insert or update on proveedor_desempeno
  for each row execute function fn_proveedor_desempeno_autor();

-- La función de la 080 ahora también abre el desempeño de la OC para ese proveedor.
create or replace function fn_oc_item_sync_proveedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nit text := regexp_replace(coalesce(new.proveedor_nit, ''), '\D', '', 'g');
begin
  if v_nit <> '' then
    insert into proveedores (nit, nombre, email, origen)
    values (
      trim(new.proveedor_nit),
      coalesce(nullif(trim(new.proveedor_nombre), ''), trim(new.proveedor_nit)),
      nullif(trim(new.proveedor_email), ''),
      'oc'
    )
    on conflict do nothing;

    insert into proveedor_desempeno (proveedor_id, orden_id)
    select p.id, new.orden_id
    from proveedores p
    where p.nit_normalizado = v_nit
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- Las OC que ya existen también arrancan con su desempeño.
insert into proveedor_desempeno (proveedor_id, orden_id)
select distinct p.id, i.orden_id
from orden_compra_items i
join proveedores p on p.nit_normalizado = i.proveedor_nit_normalizado
where i.proveedor_nit_normalizado is not null
on conflict do nothing;

-- Parámetros de evaluación (los edita el supervisor desde Configuración).
alter table config_app
  add column if not exists proveedor_umbral_aprobacion integer not null default 85
    check (proveedor_umbral_aprobacion between 0 and 100),
  add column if not exists proveedor_peso_calidad integer not null default 25
    check (proveedor_peso_calidad between 0 and 100),
  add column if not exists proveedor_peso_devoluciones integer not null default 25
    check (proveedor_peso_devoluciones between 0 and 100),
  add column if not exists proveedor_peso_cantidad integer not null default 25
    check (proveedor_peso_cantidad between 0 and 100),
  add column if not exists proveedor_peso_tiempo integer not null default 25
    check (proveedor_peso_tiempo between 0 and 100),
  add column if not exists proveedor_penalizacion_dia numeric not null default 5
    check (proveedor_penalizacion_dia >= 0),
  add column if not exists proveedor_penalizacion_devolucion numeric not null default 25
    check (proveedor_penalizacion_devolucion >= 0);

alter table proveedor_desempeno enable row level security;

drop policy if exists proveedor_desempeno_select on proveedor_desempeno;
create policy proveedor_desempeno_select on proveedor_desempeno
  for select using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedor_desempeno_insert on proveedor_desempeno;
create policy proveedor_desempeno_insert on proveedor_desempeno
  for insert with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedor_desempeno_update on proveedor_desempeno;
create policy proveedor_desempeno_update on proveedor_desempeno
  for update
  using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'))
  with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedor_desempeno_delete on proveedor_desempeno;
create policy proveedor_desempeno_delete on proveedor_desempeno
  for delete using (get_user_rol() = 'supervisor');

revoke all on proveedor_desempeno from anon;
grant select, insert, update, delete on proveedor_desempeno to authenticated;
grant all on proveedor_desempeno to service_role;

commit;
