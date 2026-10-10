-- B4: config_app (panel). Migra valores desde configuracion legacy si existe.

create table if not exists config_app (
  id                  int primary key default 1,
  bloquear_sin_stock  boolean not null default false,
  umbral_stock_bajo   integer not null default 2,
  constraint config_app_singleton check (id = 1)
);

insert into config_app (id, bloquear_sin_stock, umbral_stock_bajo)
select c.id, c.bloquear_sin_stock, c.umbral_stock_bajo
from configuracion c
where c.id = 1
on conflict (id) do update set
  bloquear_sin_stock = excluded.bloquear_sin_stock,
  umbral_stock_bajo = excluded.umbral_stock_bajo;

insert into config_app (id, bloquear_sin_stock, umbral_stock_bajo)
values (1, false, 2)
on conflict (id) do nothing;

alter table config_app enable row level security;

drop policy if exists config_app_select on config_app;
create policy config_app_select on config_app
  for select using (get_user_rol() is not null);

drop policy if exists config_app_update_supervisor on config_app;
create policy config_app_update_supervisor on config_app
  for update using (get_user_rol() = 'supervisor');

grant select on config_app to authenticated;
grant update on config_app to authenticated;
