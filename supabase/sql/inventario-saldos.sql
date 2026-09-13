-- Ejecutar en Supabase → SQL Editor (una sola vez).
-- Crea tablas para publicar saldos de inventario (Excel) para todo el equipo.

create table if not exists public.inventario_saldos (
  codigo         text primary key,
  nombre         text,
  unidad         text,
  categoria      text,
  ubicacion      text,
  saldo          numeric(14, 2) not null default 0,
  valor_unitario numeric(14, 2),
  valor_total    numeric(14, 2) not null default 0,
  updated_at     timestamptz not null default now()
);

create index if not exists idx_inventario_saldos_categoria on public.inventario_saldos (categoria);
create index if not exists idx_inventario_saldos_ubicacion on public.inventario_saldos (ubicacion);
create index if not exists idx_inventario_saldos_nombre on public.inventario_saldos (nombre);

create table if not exists public.inventario_saldos_meta (
  id              smallint primary key check (id = 1),
  fecha_corte     text,
  total_productos integer not null default 0,
  imported_at     timestamptz not null default now(),
  imported_by     uuid references auth.users (id)
);

insert into public.inventario_saldos_meta (id, fecha_corte, total_productos)
values (1, null, 0)
on conflict (id) do nothing;

alter table public.inventario_saldos enable row level security;
alter table public.inventario_saldos_meta enable row level security;

drop policy if exists "autenticados leen inventario saldos" on public.inventario_saldos;
create policy "autenticados leen inventario saldos"
  on public.inventario_saldos for select to authenticated using (true);

drop policy if exists "supervisor compras publican inventario saldos" on public.inventario_saldos;
create policy "supervisor compras publican inventario saldos"
  on public.inventario_saldos for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol in ('supervisor', 'compras'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol in ('supervisor', 'compras'))
  );

drop policy if exists "autenticados leen inventario saldos meta" on public.inventario_saldos_meta;
create policy "autenticados leen inventario saldos meta"
  on public.inventario_saldos_meta for select to authenticated using (true);

drop policy if exists "supervisor compras actualizan inventario saldos meta" on public.inventario_saldos_meta;
create policy "supervisor compras actualizan inventario saldos meta"
  on public.inventario_saldos_meta for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol in ('supervisor', 'compras'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol in ('supervisor', 'compras'))
  );

grant select on public.inventario_saldos to authenticated;
grant select on public.inventario_saldos_meta to authenticated;
grant insert, update, delete on public.inventario_saldos to authenticated;
grant insert, update, delete on public.inventario_saldos_meta to authenticated;
