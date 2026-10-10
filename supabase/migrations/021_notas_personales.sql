create table if not exists notas_personales (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  contenido text not null check (length(trim(contenido)) >= 1),
  created_at timestamptz not null default now()
);

alter table notas_personales enable row level security;

drop policy if exists notas_personales_select on notas_personales;
create policy notas_personales_select on notas_personales
  for select using (usuario_id = auth.uid());

drop policy if exists notas_personales_insert on notas_personales;
create policy notas_personales_insert on notas_personales
  for insert with check (usuario_id = auth.uid());

drop policy if exists notas_personales_delete on notas_personales;
create policy notas_personales_delete on notas_personales
  for delete using (usuario_id = auth.uid());

grant select, insert, delete on notas_personales to authenticated;
