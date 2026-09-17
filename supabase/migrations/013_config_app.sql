-- 013_config_app.sql
-- B4 del PDF de faltantes: configuración global de la app.

create table config_app (
  id                  int primary key default 1,
  bloquear_sin_stock  boolean not null default false,
  umbral_stock_bajo   integer not null default 2,
  constraint config_app_singleton check (id = 1)  -- fuerza que solo exista 1 fila
);

insert into config_app (id, bloquear_sin_stock, umbral_stock_bajo)
values (1, false, 2);

alter table config_app enable row level security;

-- Lectura: cualquier autenticado activo
create policy config_app_select on config_app
  for select using (get_user_rol() is not null);

-- Escritura: solo supervisor
create policy config_app_update_supervisor on config_app
  for update using (get_user_rol() = 'supervisor');

grant select on config_app to authenticated;
grant update on config_app to authenticated;