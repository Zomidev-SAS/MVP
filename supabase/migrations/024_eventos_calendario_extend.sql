-- Extender eventos: rango de fechas, secciones internas y fechas adicionales

alter table eventos_calendario
  add column if not exists fecha_fin date;

alter table eventos_calendario
  drop constraint if exists eventos_calendario_fecha_fin_check;

alter table eventos_calendario
  add constraint eventos_calendario_fecha_fin_check
  check (fecha_fin is null or fecha_fin >= fecha);

create table if not exists evento_secciones (
  id bigint generated always as identity primary key,
  evento_id bigint not null references eventos_calendario(id) on delete cascade,
  titulo text not null check (length(trim(titulo)) >= 1),
  completada boolean not null default false,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists evento_fechas (
  id bigint generated always as identity primary key,
  evento_id bigint not null references eventos_calendario(id) on delete cascade,
  fecha date not null,
  unique (evento_id, fecha)
);

create index if not exists idx_evento_secciones_evento_id on evento_secciones(evento_id);
create index if not exists idx_evento_fechas_evento_id on evento_fechas(evento_id);
create index if not exists idx_evento_fechas_fecha on evento_fechas(fecha);

alter table evento_secciones enable row level security;
alter table evento_fechas enable row level security;

drop policy if exists eventos_calendario_update on eventos_calendario;
create policy eventos_calendario_update on eventos_calendario
  for update using (usuario_id = auth.uid());

drop policy if exists evento_secciones_select on evento_secciones;
create policy evento_secciones_select on evento_secciones
  for select using (
    exists (
      select 1 from eventos_calendario e
      where e.id = evento_secciones.evento_id and e.usuario_id = auth.uid()
    )
  );

drop policy if exists evento_secciones_insert on evento_secciones;
create policy evento_secciones_insert on evento_secciones
  for insert with check (
    exists (
      select 1 from eventos_calendario e
      where e.id = evento_secciones.evento_id and e.usuario_id = auth.uid()
    )
  );

drop policy if exists evento_secciones_update on evento_secciones;
create policy evento_secciones_update on evento_secciones
  for update using (
    exists (
      select 1 from eventos_calendario e
      where e.id = evento_secciones.evento_id and e.usuario_id = auth.uid()
    )
  );

drop policy if exists evento_secciones_delete on evento_secciones;
create policy evento_secciones_delete on evento_secciones
  for delete using (
    exists (
      select 1 from eventos_calendario e
      where e.id = evento_secciones.evento_id and e.usuario_id = auth.uid()
    )
  );

drop policy if exists evento_fechas_select on evento_fechas;
create policy evento_fechas_select on evento_fechas
  for select using (
    exists (
      select 1 from eventos_calendario e
      where e.id = evento_fechas.evento_id and e.usuario_id = auth.uid()
    )
  );

drop policy if exists evento_fechas_insert on evento_fechas;
create policy evento_fechas_insert on evento_fechas
  for insert with check (
    exists (
      select 1 from eventos_calendario e
      where e.id = evento_fechas.evento_id and e.usuario_id = auth.uid()
    )
  );

drop policy if exists evento_fechas_delete on evento_fechas;
create policy evento_fechas_delete on evento_fechas
  for delete using (
    exists (
      select 1 from eventos_calendario e
      where e.id = evento_fechas.evento_id and e.usuario_id = auth.uid()
    )
  );

grant update on eventos_calendario to authenticated;
grant select, insert, update, delete on evento_secciones to authenticated;
grant select, insert, delete on evento_fechas to authenticated;
