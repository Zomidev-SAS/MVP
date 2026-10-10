-- B14: el reporte semanal se envía "usando la misma cola de correos" (4.1),
-- pero con un CSV adjunto. cola_correos gana dos columnas opcionales para
-- ese único caso; el resto de correos (notificaciones, mensajes) nunca las usa.

alter table cola_correos
  add column if not exists adjunto_nombre text,
  add column if not exists adjunto_base64 text;

create or replace function fn_encolar_correo(
  p_usuario_id uuid,
  p_tipo       text,
  p_asunto     text,
  p_cuerpo     text,
  p_origen     text,
  p_enlace     text default null,
  p_adjunto_nombre text default null,
  p_adjunto_base64 text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text;
  v_activo boolean;
begin
  select u.email, p.activo into v_email, v_activo
  from auth.users u
  join profiles p on p.id = u.id
  where u.id = p_usuario_id;

  if v_email is null or coalesce(v_activo, false) = false then
    return;
  end if;

  insert into cola_correos (
    destinatario, usuario_id, tipo, asunto, cuerpo, enlace, origen,
    adjunto_nombre, adjunto_base64
  )
  values (
    v_email, p_usuario_id, p_tipo, p_asunto, p_cuerpo, p_enlace, p_origen,
    p_adjunto_nombre, p_adjunto_base64
  )
  on conflict (origen, destinatario) do nothing;
end;
$$;
