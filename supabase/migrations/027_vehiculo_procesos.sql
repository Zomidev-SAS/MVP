-- Historial de procesos del vehículo (etapa "En proceso" en la línea de tiempo del dashboard).
-- Append-only: no hay UPDATE/DELETE, cada avance se registra como fila nueva.
create table if not exists vehiculo_procesos (
  id uuid primary key default gen_random_uuid(),
  chasis text not null,
  titulo text not null check (length(trim(titulo)) >= 1),
  proceso_estado text not null check (length(trim(proceso_estado)) >= 1),
  observaciones text,
  seccion_siguiente text,
  creado_por uuid references auth.users(id),
  creado_por_nombre text,
  creado_en timestamptz not null default now()
);

create index if not exists vehiculo_procesos_chasis_idx on vehiculo_procesos (chasis);

-- El cliente nunca controla quién ni cuándo — lo fuerza el trigger, no el insert.
create or replace function set_vehiculo_proceso_autor()
returns trigger language plpgsql security definer as $$
begin
  new.creado_por := auth.uid();
  new.creado_por_nombre := (select nombre from profiles where id = auth.uid());
  new.creado_en := now();
  return new;
end;
$$;

drop trigger if exists vehiculo_procesos_set_autor on vehiculo_procesos;
create trigger vehiculo_procesos_set_autor
  before insert on vehiculo_procesos
  for each row execute function set_vehiculo_proceso_autor();

alter table vehiculo_procesos enable row level security;

drop policy if exists vehiculo_procesos_select on vehiculo_procesos;
create policy vehiculo_procesos_select on vehiculo_procesos
  for select using (get_user_rol() is not null and get_user_rol() <> 'lectura');

drop policy if exists vehiculo_procesos_insert on vehiculo_procesos;
create policy vehiculo_procesos_insert on vehiculo_procesos
  for insert
  with check (get_user_rol() in ('supervisor', 'metalmecanica', 'instalacion'));

grant select, insert on vehiculo_procesos to authenticated;
