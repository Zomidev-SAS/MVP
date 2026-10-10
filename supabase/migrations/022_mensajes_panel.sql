create table if not exists mensajes_panel (
  id bigint generated always as identity primary key,
  titulo text not null check (length(trim(titulo)) >= 1),
  cuerpo text not null check (length(trim(cuerpo)) >= 1),
  nivel text not null default 'info' check (nivel in ('info', 'aviso', 'urgente')),
  rol_destino text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists mensajes_leidos (
  mensaje_id bigint not null references mensajes_panel(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  leido_at timestamptz not null default now(),
  primary key (mensaje_id, usuario_id)
);

alter table mensajes_panel enable row level security;
alter table mensajes_leidos enable row level security;

drop policy if exists mensajes_panel_select on mensajes_panel;
create policy mensajes_panel_select on mensajes_panel
  for select using (
    get_user_rol() is not null
    and (rol_destino is null or rol_destino = get_user_rol())
  );

drop policy if exists mensajes_panel_insert on mensajes_panel;
create policy mensajes_panel_insert on mensajes_panel
  for insert with check (get_user_rol() = 'supervisor');

drop policy if exists mensajes_leidos_select on mensajes_leidos;
create policy mensajes_leidos_select on mensajes_leidos
  for select using (usuario_id = auth.uid());

drop policy if exists mensajes_leidos_insert on mensajes_leidos;
create policy mensajes_leidos_insert on mensajes_leidos
  for insert with check (usuario_id = auth.uid());

grant select on mensajes_panel to authenticated;
grant insert on mensajes_panel to authenticated;
grant select, insert on mensajes_leidos to authenticated;
