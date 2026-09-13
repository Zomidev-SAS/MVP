-- Permite al panel leer formularios de la app (solo lectura).
-- Correr en Supabase Dashboard → SQL Editor si la tabla ya existe.

grant select on public.formularios to authenticated;

alter table public.formularios enable row level security;

drop policy if exists "panel lee formularios" on public.formularios;
create policy "panel lee formularios"
  on public.formularios for select
  to authenticated
  using (true);
