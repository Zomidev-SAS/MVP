-- B13 (parte SQL): cola_correos + conexión de notificaciones (B3/B4) y
-- mensajes_panel para que TODO lo que genera una notificación o un mensaje
-- también quede encolado para enviarse por correo. El envío real (Resend,
-- la plantilla HTML y el agrupado antispam de 10 minutos) lo hace la Edge
-- Function enviar-correos (fuera de SQL), que procesa esta cola cada minuto
-- (pg_cron, migración 039).

create table if not exists cola_correos (
  id             bigint generated always as identity primary key,
  destinatario   text not null,          -- email
  usuario_id     uuid references auth.users(id),
  tipo           text not null,          -- mismo 'tipo' de la notificación, para agrupar
  asunto         text not null,
  cuerpo         text not null,
  enlace         text,
  origen         text not null,          -- ej. 'notificacion:123', 'mensaje_panel:45:<uuid>'
  estado         text not null default 'pendiente'
                   check (estado in ('pendiente', 'enviando', 'enviado', 'error', 'agrupado')),
  intentos       integer not null default 0,
  max_intentos   integer not null default 5,
  error          text,
  agrupado_en    bigint references cola_correos(id),
  enviado_at     timestamptz,
  created_at     timestamptz not null default now()
);

-- No duplicar el mismo correo para el mismo destinatario por el mismo origen.
create unique index if not exists uq_cola_correos_origen_destinatario
  on cola_correos(origen, destinatario);

create index if not exists idx_cola_correos_pendientes
  on cola_correos(estado, created_at) where estado = 'pendiente';
create index if not exists idx_cola_correos_destinatario_tipo_fecha
  on cola_correos(destinatario, tipo, created_at desc);

alter table cola_correos enable row level security;

-- Solo supervisor y auditoría (igual que eventos_sistema y log_automatizaciones).
drop policy if exists cola_correos_select on cola_correos;
create policy cola_correos_select on cola_correos
  for select using (get_user_rol() in ('supervisor', 'auditoria'));

grant select on cola_correos to authenticated;

-- ===================== Encolar un correo =====================
-- Usuarios desactivados nunca reciben: se valida profiles.activo acá, en un
-- solo lugar, para que ninguna regla nueva tenga que acordarse de filtrarlo.
create or replace function fn_encolar_correo(
  p_usuario_id uuid,
  p_tipo       text,
  p_asunto     text,
  p_cuerpo     text,
  p_origen     text,
  p_enlace     text default null
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

  insert into cola_correos (destinatario, usuario_id, tipo, asunto, cuerpo, enlace, origen)
  values (v_email, p_usuario_id, p_tipo, p_asunto, p_cuerpo, p_enlace, p_origen)
  on conflict (origen, destinatario) do nothing;
end;
$$;

-- ===================== Conectar con notificaciones (B3/B4) =====================
-- Reemplaza fn_crear_notificacion (033) para que, además de insertar la
-- notificación, encole su correo. Misma firma, mismo comportamiento previo,
-- solo se agrega el encolado.
create or replace function fn_crear_notificacion(
  p_tipo            text,
  p_titulo          text,
  p_mensaje         text,
  p_enlace          text default null,
  p_usuario_destino uuid default null,
  p_rol_destino     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notif_id bigint;
  v_rec      record;
begin
  if p_usuario_destino is not null then
    insert into notificaciones (usuario_destino, tipo, titulo, mensaje, enlace)
    values (p_usuario_destino, p_tipo, p_titulo, p_mensaje, p_enlace)
    returning id into v_notif_id;

    perform fn_encolar_correo(
      p_usuario_id => p_usuario_destino,
      p_tipo       => p_tipo,
      p_asunto     => p_titulo,
      p_cuerpo     => p_mensaje,
      p_origen     => 'notificacion:' || v_notif_id,
      p_enlace     => p_enlace
    );

  elsif p_rol_destino is not null then
    for v_rec in
      select id from profiles where rol = p_rol_destino and activo = true
    loop
      insert into notificaciones (usuario_destino, tipo, titulo, mensaje, enlace)
      values (v_rec.id, p_tipo, p_titulo, p_mensaje, p_enlace)
      returning id into v_notif_id;

      perform fn_encolar_correo(
        p_usuario_id => v_rec.id,
        p_tipo       => p_tipo,
        p_asunto     => p_titulo,
        p_cuerpo     => p_mensaje,
        p_origen     => 'notificacion:' || v_notif_id,
        p_enlace     => p_enlace
      );
    end loop;
  end if;
end;
$$;

-- ===================== Conectar con mensajes_panel =====================
-- mensajes_panel solo tenía rol_destino (o null = todos los roles activos).
-- Se agrega usuario_destino opcional para mensajes puntuales, tal como pide
-- el punto 3.13 ("por rol_destino o por usuario").
alter table mensajes_panel
  add column if not exists usuario_destino uuid references auth.users(id);

create or replace function fn_fanout_mensaje_panel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
begin
  if NEW.usuario_destino is not null then
    perform fn_encolar_correo(
      p_usuario_id => NEW.usuario_destino,
      p_tipo        => 'mensaje_panel_' || NEW.nivel,
      p_asunto      => NEW.titulo,
      p_cuerpo       => NEW.cuerpo,
      p_origen       => 'mensaje_panel:' || NEW.id || ':' || NEW.usuario_destino,
      p_enlace       => '/mensajes'
    );
    return NEW;
  end if;

  for v_rec in
    select id from profiles
    where activo = true
      and (NEW.rol_destino is null or rol = NEW.rol_destino)
  loop
    perform fn_encolar_correo(
      p_usuario_id => v_rec.id,
      p_tipo        => 'mensaje_panel_' || NEW.nivel,
      p_asunto      => NEW.titulo,
      p_cuerpo       => NEW.cuerpo,
      p_origen       => 'mensaje_panel:' || NEW.id || ':' || v_rec.id,
      p_enlace       => '/mensajes'
    );
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_fanout_mensaje_panel on mensajes_panel;
create trigger trg_fanout_mensaje_panel
  after insert on mensajes_panel
  for each row execute function fn_fanout_mensaje_panel();
