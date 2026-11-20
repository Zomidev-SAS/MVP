-- B3: Notificaciones automáticas.
--
-- Decisión de diseño (para que el contador de "no leídas" sea exacto por
-- usuario, tal como pide el criterio de aceptación): cada fila de
-- `notificaciones` es SIEMPRE para UN usuario puntual (`usuario_destino`).
-- Cuando una regla dice "va para el rol supervisor", lo que pasa es que
-- `fn_crear_notificacion` reparte una fila por cada usuario activo de ese rol
-- en ese momento — así "leída" es realmente personal y no se comparte entre
-- varias personas del mismo rol.
--
-- El envío de correo (3.13) se conecta más adelante: en la migración de B13
-- se reemplaza `fn_crear_notificacion` (CREATE OR REPLACE) para que, además
-- de insertar la notificación, encole el correo en `cola_correos`. No rompe
-- nada de lo que se construye aquí.

create table if not exists notificaciones (
  id               bigint generated always as identity primary key,
  usuario_destino  uuid not null references auth.users(id) on delete cascade,
  tipo             text not null,
  titulo           text not null check (length(trim(titulo)) >= 1),
  mensaje          text not null check (length(trim(mensaje)) >= 1),
  enlace           text,
  leida            boolean not null default false,
  leida_at         timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists idx_notificaciones_usuario_no_leidas
  on notificaciones(usuario_destino) where leida = false;
create index if not exists idx_notificaciones_usuario_fecha
  on notificaciones(usuario_destino, created_at desc);

alter table notificaciones enable row level security;

drop policy if exists notificaciones_select on notificaciones;
create policy notificaciones_select on notificaciones
  for select using (usuario_destino = auth.uid());

-- Solo se permite UPDATE de 'leida'/'leida_at' sobre las propias notificaciones,
-- y solo a través de las funciones RPC de abajo (no se otorga UPDATE directo).
grant select on notificaciones to authenticated;

-- ===================== Función central: crear notificación =====================
-- Si p_usuario_destino viene informado, crea una sola fila para ese usuario.
-- Si en cambio viene p_rol_destino, reparte una fila por cada usuario activo
-- de ese rol. Si vienen ambos, se prioriza el usuario puntual.
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
begin
  if p_usuario_destino is not null then
    insert into notificaciones (usuario_destino, tipo, titulo, mensaje, enlace)
    values (p_usuario_destino, p_tipo, p_titulo, p_mensaje, p_enlace);

  elsif p_rol_destino is not null then
    insert into notificaciones (usuario_destino, tipo, titulo, mensaje, enlace)
    select id, p_tipo, p_titulo, p_mensaje, p_enlace
    from profiles
    where rol = p_rol_destino and activo = true;
  end if;
end;
$$;

-- No se otorga EXECUTE a 'authenticated': esta función solo la llaman los
-- triggers y las Edge Functions con service_role.

-- ===================== RPCs para el panel =====================
create or replace function marcar_notificacion_leida(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update notificaciones
  set leida = true, leida_at = now()
  where id = p_id and usuario_destino = auth.uid();
end;
$$;

create or replace function marcar_todas_leidas()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update notificaciones
  set leida = true, leida_at = now()
  where usuario_destino = auth.uid() and leida = false;
end;
$$;

grant execute on function marcar_notificacion_leida(bigint) to authenticated;
grant execute on function marcar_todas_leidas() to authenticated;

-- ===================== Reglas automáticas =====================

-- Regla: ajuste creado -> supervisor
create or replace function fn_notificar_ajuste_creado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform fn_crear_notificacion(
    p_tipo            => 'ajuste_creado',
    p_titulo          => 'Nuevo ajuste pendiente',
    p_mensaje         => 'Hay un ajuste de inventario esperando tu revisión (#' || NEW.id || ').',
    p_enlace          => '/ajustes/' || NEW.id,
    p_rol_destino     => 'supervisor'
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notificar_ajuste_creado on ajustes_pendientes;
create trigger trg_notificar_ajuste_creado
  after insert on ajustes_pendientes
  for each row execute function fn_notificar_ajuste_creado();

-- Regla: ajuste resuelto -> el usuario que lo solicitó
create or replace function fn_notificar_ajuste_resuelto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform fn_crear_notificacion(
    p_tipo             => 'ajuste_resuelto',
    p_titulo           => case when NEW.estado = 'aprobado' then 'Tu ajuste fue aprobado' else 'Tu ajuste fue rechazado' end,
    p_mensaje          => case
                             when NEW.estado = 'aprobado' then 'El ajuste #' || NEW.id || ' que solicitaste fue aprobado.'
                             else 'El ajuste #' || NEW.id || ' que solicitaste fue rechazado' || coalesce(': ' || NEW.motivo_rechazo, '.')
                           end,
    p_enlace           => '/ajustes/' || NEW.id,
    p_usuario_destino  => NEW.solicitado_por
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notificar_ajuste_resuelto on ajustes_pendientes;
create trigger trg_notificar_ajuste_resuelto
  after update of estado on ajustes_pendientes
  for each row
  when (OLD.estado = 'pendiente' and NEW.estado <> 'pendiente')
  execute function fn_notificar_ajuste_resuelto();

-- Regla: ingreso desde la app (formulario nuevo) -> metalmecánica y producción
-- NOTA: igual que en 031, 'formularios' en producción tiene su propio esquema;
-- si no existe una columna de referencia legible para el mensaje, ajustar.
create or replace function fn_notificar_formulario_ingreso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform fn_crear_notificacion(
    p_tipo        => 'formulario_recibido',
    p_titulo      => 'Nuevo ingreso desde la app',
    p_mensaje     => 'Llegó un formulario nuevo desde la app (#' || NEW.id || ').',
    p_enlace      => '/formularios/' || NEW.id,
    p_rol_destino => 'metalmecanica'
  );
  perform fn_crear_notificacion(
    p_tipo        => 'formulario_recibido',
    p_titulo      => 'Nuevo ingreso desde la app',
    p_mensaje     => 'Llegó un formulario nuevo desde la app (#' || NEW.id || ').',
    p_enlace      => '/formularios/' || NEW.id,
    p_rol_destino => 'produccion'
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notificar_formulario on formularios;
create trigger trg_notificar_formulario
  after insert on formularios
  for each row execute function fn_notificar_formulario_ingreso();

-- ===================== Realtime =====================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notificaciones'
  ) then
    alter publication supabase_realtime add table notificaciones;
  end if;
end $$;
