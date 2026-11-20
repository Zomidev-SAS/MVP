-- B7: Cola de reintentos para fallas de sincronización VIN y de Siigo.
-- Hasta 5 reintentos (cada 5 minutos, vía pg_cron en 039); si se agotan,
-- notificación + correo al supervisor y la fila queda en estado 'fallido'
-- para revisión manual.

create table if not exists sync_pendientes (
  id               bigint generated always as identity primary key,
  tipo             text not null check (tipo in ('sync_vin', 'siigo_oc', 'siigo_catalogo')),
  referencia_id    text not null,      -- formulario_id, orden_compra id, etc.
  payload          jsonb not null,
  motivo           text not null,
  intentos         integer not null default 0,
  max_intentos     integer not null default 5,
  proximo_intento  timestamptz not null default now(),
  estado           text not null default 'pendiente'
                     check (estado in ('pendiente', 'reintentando', 'resuelto', 'fallido')),
  created_at       timestamptz not null default now(),
  resuelto_at      timestamptz
);

create index if not exists idx_sync_pendientes_estado_proximo
  on sync_pendientes(estado, proximo_intento) where estado in ('pendiente', 'reintentando');
create index if not exists idx_sync_pendientes_tipo on sync_pendientes(tipo);
create index if not exists idx_sync_pendientes_referencia on sync_pendientes(referencia_id);

alter table sync_pendientes enable row level security;

drop policy if exists sync_pendientes_select on sync_pendientes;
create policy sync_pendientes_select on sync_pendientes
  for select using (get_user_rol() in ('supervisor', 'compras', 'auditoria'));

grant select on sync_pendientes to authenticated;

-- Encola una falla (llamado desde sync-inventario-vin / siigo-sync-oc cuando
-- el intento inmediato falla, vía service_role — no se otorga insert directo
-- a 'authenticated').
create or replace function fn_encolar_sync_pendiente(
  p_tipo          text,
  p_referencia_id text,
  p_payload       jsonb,
  p_motivo        text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into sync_pendientes (tipo, referencia_id, payload, motivo)
  values (p_tipo, p_referencia_id, p_payload, p_motivo)
  returning id into v_id;
  return v_id;
end;
$$;

-- Marca un intento: si se resolvió, cierra la fila; si no, agenda el
-- siguiente intento (5 min después) o la marca 'fallido' si llegó al tope,
-- notificando y encolando correo al supervisor.
create or replace function fn_registrar_intento_sync(
  p_id         bigint,
  p_exitoso    boolean,
  p_motivo     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila sync_pendientes%rowtype;
begin
  select * into v_fila from sync_pendientes where id = p_id for update;
  if not found then
    return;
  end if;

  if p_exitoso then
    update sync_pendientes
    set estado = 'resuelto', resuelto_at = now()
    where id = p_id;
    return;
  end if;

  if v_fila.intentos + 1 >= v_fila.max_intentos then
    update sync_pendientes
    set intentos = intentos + 1,
        estado = 'fallido',
        motivo = coalesce(p_motivo, motivo)
    where id = p_id;

    perform fn_crear_notificacion(
      p_tipo        => v_fila.tipo || '_fallido',
      p_titulo      => 'Sincronización fallida tras ' || v_fila.max_intentos || ' intentos',
      p_mensaje     => 'No se pudo completar "' || v_fila.tipo || '" para ' || v_fila.referencia_id ||
                        coalesce('. Motivo: ' || p_motivo, '.'),
      p_enlace      => '/automatizaciones',
      p_rol_destino => 'supervisor'
    );
  else
    update sync_pendientes
    set intentos = intentos + 1,
        estado = 'pendiente',
        proximo_intento = now() + interval '5 minutes',
        motivo = coalesce(p_motivo, motivo)
    where id = p_id;
  end if;
end;
$$;
