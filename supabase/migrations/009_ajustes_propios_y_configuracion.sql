-- F4: el solicitante ve sus propios ajustes (ademas del supervisor, que ya los ve todos).
-- Postgres OR-ea multiples policies SELECT sobre la misma tabla, asi que esto
-- no reemplaza "supervisor lee ajustes pendientes" (migracion 006), lo complementa.
drop policy if exists "solicitante lee sus propios ajustes" on public.ajustes_pendientes;
create policy "solicitante lee sus propios ajustes"
  on public.ajustes_pendientes for select
  to authenticated
  using (solicitado_por = auth.uid());

-- F9: configuracion global editable por el supervisor, legible por cualquier
-- autenticado (incluida la futura app movil).
create table if not exists public.configuracion (
  id                 smallint primary key check (id = 1),
  bloquear_sin_stock boolean not null default false,
  umbral_stock_bajo  integer not null default 2,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users (id)
);

insert into public.configuracion (id, bloquear_sin_stock, umbral_stock_bajo)
values (1, false, 2)
on conflict (id) do nothing;

alter table public.configuracion enable row level security;

drop policy if exists "autenticados leen configuracion" on public.configuracion;
create policy "autenticados leen configuracion"
  on public.configuracion for select
  to authenticated
  using (true);

drop policy if exists "supervisor actualiza configuracion" on public.configuracion;
create policy "supervisor actualiza configuracion"
  on public.configuracion for update
  to authenticated
  using (is_supervisor())
  with check (is_supervisor());

grant select on public.configuracion to authenticated;
grant update on public.configuracion to authenticated;
