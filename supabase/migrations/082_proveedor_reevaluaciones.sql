-- 082: reevaluación anual de proveedores (una por proveedor y año).
--
-- porcentaje y detalle son una copia del cálculo en el momento de evaluar, para que la constancia
-- no cambie si después cambian los pesos o el umbral. El motivo es obligatorio cuando no se continúa.

begin;

create table if not exists proveedor_reevaluaciones (
  id                bigint generated always as identity primary key,
  proveedor_id      bigint not null references proveedores(id) on delete cascade,
  anio              integer not null check (anio between 2000 and 2100),
  porcentaje        numeric not null check (porcentaje between 0 and 100),
  umbral            numeric not null check (umbral between 0 and 100),
  resultado         text not null check (resultado in ('continuar', 'no_continuar')),
  motivo            text,
  detalle           jsonb not null default '{}'::jsonb,
  creado_por        uuid references auth.users(id),
  creado_por_nombre text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint reevaluacion_motivo_si_no_continua
    check (resultado = 'continuar' or length(trim(coalesce(motivo, ''))) >= 1),
  constraint uq_reevaluacion_proveedor_anio unique (proveedor_id, anio)
);

create or replace function fn_proveedor_reevaluacion_autor()
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

drop trigger if exists trg_proveedor_reevaluacion_autor on proveedor_reevaluaciones;
create trigger trg_proveedor_reevaluacion_autor
  before insert or update on proveedor_reevaluaciones
  for each row execute function fn_proveedor_reevaluacion_autor();

alter table proveedor_reevaluaciones enable row level security;

drop policy if exists proveedor_reevaluaciones_select on proveedor_reevaluaciones;
create policy proveedor_reevaluaciones_select on proveedor_reevaluaciones
  for select using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedor_reevaluaciones_insert on proveedor_reevaluaciones;
create policy proveedor_reevaluaciones_insert on proveedor_reevaluaciones
  for insert with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedor_reevaluaciones_update on proveedor_reevaluaciones;
create policy proveedor_reevaluaciones_update on proveedor_reevaluaciones
  for update
  using (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'))
  with check (get_user_rol() in ('supervisor', 'comercial', 'compras', 'auditoria'));

drop policy if exists proveedor_reevaluaciones_delete on proveedor_reevaluaciones;
create policy proveedor_reevaluaciones_delete on proveedor_reevaluaciones
  for delete using (get_user_rol() = 'supervisor');

revoke all on proveedor_reevaluaciones from anon;
grant select, insert, update, delete on proveedor_reevaluaciones to authenticated;
grant all on proveedor_reevaluaciones to service_role;

commit;
