create table if not exists eventos_calendario (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null,
  titulo text not null check (length(trim(titulo)) >= 1),
  nota text,
  created_at timestamptz not null default now()
);

alter table eventos_calendario enable row level security;

drop policy if exists eventos_calendario_select on eventos_calendario;
create policy eventos_calendario_select on eventos_calendario
  for select using (usuario_id = auth.uid());

drop policy if exists eventos_calendario_insert on eventos_calendario;
create policy eventos_calendario_insert on eventos_calendario
  for insert with check (usuario_id = auth.uid());

drop policy if exists eventos_calendario_delete on eventos_calendario;
create policy eventos_calendario_delete on eventos_calendario
  for delete using (usuario_id = auth.uid());

grant select, insert, delete on eventos_calendario to authenticated;
