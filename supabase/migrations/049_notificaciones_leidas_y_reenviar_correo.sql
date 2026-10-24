-- 049: (1) notificaciones_leidas: marca por usuario y categoría cuál fue la
-- última "firma" (estado) vista, para el indicador de pendientes del panel.
--      (2) rpc_reenviar_correo: el supervisor reencola un correo en estado
-- 'error' de cola_correos (cola_correos solo tiene SELECT para authenticated).

create table if not exists notificaciones_leidas (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  categoria  text not null,
  firma      text not null,
  leida_at   timestamptz not null default now(),
  primary key (usuario_id, categoria)
);

alter table notificaciones_leidas enable row level security;

drop policy if exists notificaciones_leidas_select on notificaciones_leidas;
create policy notificaciones_leidas_select on notificaciones_leidas
  for select using (usuario_id = auth.uid());

drop policy if exists notificaciones_leidas_insert on notificaciones_leidas;
create policy notificaciones_leidas_insert on notificaciones_leidas
  for insert with check (usuario_id = auth.uid());

drop policy if exists notificaciones_leidas_update on notificaciones_leidas;
create policy notificaciones_leidas_update on notificaciones_leidas
  for update using (usuario_id = auth.uid());

grant select, insert, update on notificaciones_leidas to authenticated;

create or replace function rpc_reenviar_correo(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actualizado bigint;
begin
  if get_user_rol() <> 'supervisor' then
    raise exception 'Sin permiso para reenviar correos';
  end if;

  update cola_correos
  set estado = 'pendiente', intentos = 0, error = null
  where id = p_id and estado = 'error'
  returning id into v_actualizado;

  if v_actualizado is null then
    raise exception 'El correo % no existe o no está en estado error', p_id;
  end if;
end;
$$;

revoke all on function rpc_reenviar_correo(bigint) from public;
grant execute on function rpc_reenviar_correo(bigint) to authenticated;
