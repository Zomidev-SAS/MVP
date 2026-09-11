create table eventos_calendario (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null,
  titulo text not null check (length(trim(titulo)) >= 1),
  nota text,
  created_at timestamptz not null default now()
);

create index idx_eventos_usuario_fecha on eventos_calendario(usuario_id, fecha);

alter table eventos_calendario enable row level security;

create policy "usuarios ven solo sus propios eventos"
  on eventos_calendario for select
  using (usuario_id = auth.uid());

create policy "usuarios insertan solo sus propios eventos"
  on eventos_calendario for insert
  with check (usuario_id = auth.uid());

create policy "usuarios borran solo sus propios eventos"
  on eventos_calendario for delete
  using (usuario_id = auth.uid());
