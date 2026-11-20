-- 083: evaluación de selección de proveedores nuevos (cuadro comparativo).
--
-- Una selección compara varios candidatos (proveedores existentes o nuevos todavía sin catálogo)
-- en precio, tiempo de entrega y calidad. La decisión final la toma una persona.

begin;

create table if not exists proveedor_selecciones (
  id                    bigint generated always as identity primary key,
  titulo                text not null check (length(trim(titulo)) >= 1),
  necesidad             text,
  estado                text not null default 'borrador' check (estado in ('borrador', 'decidida')),
  proveedor_elegido_id  bigint references proveedores(id) on delete set null,
  nombre_elegido        text,
  conclusion            text,
  creado_por            uuid references auth.users(id),
  creado_por_nombre     text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists proveedor_seleccion_candidatos (
  id                  bigint generated always as identity primary key,
  seleccion_id        bigint not null references proveedor_selecciones(id) on delete cascade,
  proveedor_id        bigint references proveedores(id) on delete set null,
  nombre_nuevo        text,
  precio              numeric check (precio is null or precio >= 0),
  tiempo_entrega_dias numeric check (tiempo_entrega_dias is null or tiempo_entrega_dias >= 0),
  calidad             text check (calidad is null or calidad in ('bien', 'regular', 'mal')),
  observaciones       text,
  orden               smallint not null default 1,
  constraint candidato_tiene_proveedor check (
    proveedor_id is not null or length(trim(coalesce(nombre_nuevo, ''))) >= 1
  )
);

create index if not exists idx_seleccion_candidatos_seleccion
  on proveedor_seleccion_candidatos (seleccion_id, orden);

create or replace function fn_proveedor_seleccion_autor()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
    new.creado_por_nombre := (select nombre from profiles where id = auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_proveedor_seleccion_autor on proveedor_selecciones;
create trigger trg_proveedor_seleccion_autor
  before insert or update on proveedor_selecciones
  for each row execute function fn_proveedor_seleccion_autor();

alter table proveedor_selecciones enable row level security;
alter table proveedor_seleccion_candidatos enable row level security;

drop policy if exists proveedor_selecciones_select on proveedor_selecciones;
create policy proveedor_selecciones_select on proveedor_selecciones
  for select using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));
drop policy if exists proveedor_selecciones_insert on proveedor_selecciones;
create policy proveedor_selecciones_insert on proveedor_selecciones
  for insert with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));
drop policy if exists proveedor_selecciones_update on proveedor_selecciones;
create policy proveedor_selecciones_update on proveedor_selecciones
  for update
  using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'))
  with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));
drop policy if exists proveedor_selecciones_delete on proveedor_selecciones;
create policy proveedor_selecciones_delete on proveedor_selecciones
  for delete using (get_user_rol() = 'supervisor');

drop policy if exists proveedor_seleccion_candidatos_select on proveedor_seleccion_candidatos;
create policy proveedor_seleccion_candidatos_select on proveedor_seleccion_candidatos
  for select using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));
drop policy if exists proveedor_seleccion_candidatos_insert on proveedor_seleccion_candidatos;
create policy proveedor_seleccion_candidatos_insert on proveedor_seleccion_candidatos
  for insert with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));
drop policy if exists proveedor_seleccion_candidatos_update on proveedor_seleccion_candidatos;
create policy proveedor_seleccion_candidatos_update on proveedor_seleccion_candidatos
  for update
  using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'))
  with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));
drop policy if exists proveedor_seleccion_candidatos_delete on proveedor_seleccion_candidatos;
create policy proveedor_seleccion_candidatos_delete on proveedor_seleccion_candidatos
  for delete using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

revoke all on proveedor_selecciones from anon;
revoke all on proveedor_seleccion_candidatos from anon;
grant select, insert, update, delete on proveedor_selecciones to authenticated;
grant select, insert, update, delete on proveedor_seleccion_candidatos to authenticated;
grant all on proveedor_selecciones to service_role;
grant all on proveedor_seleccion_candidatos to service_role;

commit;
