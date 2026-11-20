-- B1: Eventos del sistema. Registra sola toda acción relevante de la operación,
-- en una tabla compatible con Kafka (ver docs/EVENTOS_SISTEMA_KAFKA.md para el
-- mapeo tipo -> tópico, que es el documento corto que pide el criterio de aceptación).
--
-- NOTA IMPORTANTE sobre 'formularios': esa tabla ya existe en producción/staging
-- con su propio esquema (ver advertencia en 000_stub_formularios.sql). Este
-- archivo asume que, como mínimo, tiene una columna `id`. Si el esquema real en
-- cloud no coincide, el trigger sobre formularios fallará al aplicar — en ese
-- caso avisar antes de aplicar en cloud para ajustar el trigger a las columnas reales.

create table if not exists eventos_sistema (
  id          bigint generated always as identity primary key,
  tipo        text not null,
  entidad     text not null,
  entidad_id  text not null,
  payload     jsonb not null default '{}',
  actor       uuid references auth.users(id),
  bodega      text,
  fecha       timestamptz not null default now(),
  procesado   boolean not null default false
);

create index if not exists idx_eventos_sistema_fecha     on eventos_sistema(fecha desc);
create index if not exists idx_eventos_sistema_tipo       on eventos_sistema(tipo);
create index if not exists idx_eventos_sistema_entidad     on eventos_sistema(entidad, entidad_id);
create index if not exists idx_eventos_sistema_procesado   on eventos_sistema(procesado) where procesado = false;

-- ===================== Seguridad (adelanto de B9 para esta tabla) =====================
-- Solo supervisor y auditoría pueden leer eventos_sistema. Nadie inserta directo:
-- solo lo hacen los triggers, que corren como SECURITY DEFINER.
alter table eventos_sistema enable row level security;

drop policy if exists eventos_sistema_select on eventos_sistema;
create policy eventos_sistema_select on eventos_sistema
  for select using (get_user_rol() in ('supervisor', 'auditoria'));

-- No se otorga INSERT/UPDATE/DELETE a authenticated: solo el dueño de las
-- funciones (SECURITY DEFINER) puede escribir aquí.
grant select on eventos_sistema to authenticated;

-- ===================== Función genérica de registro =====================
create or replace function fn_registrar_evento_sistema()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo   text;
  v_actor  uuid;
  v_bodega text;
begin
  if TG_TABLE_NAME = 'movimientos_inventario' then
    v_tipo   := 'movimiento_' || NEW.tipo_movimiento;
    v_actor  := NEW.actor_id;
    v_bodega := NEW.bodega;

  elsif TG_TABLE_NAME = 'ajustes_pendientes' then
    if TG_OP = 'INSERT' then
      v_tipo  := 'ajuste_creado';
      v_actor := NEW.solicitado_por;
    else
      v_tipo  := 'ajuste_resuelto';
      v_actor := NEW.resuelto_por;
    end if;

  elsif TG_TABLE_NAME = 'ordenes_compra' then
    v_tipo  := case when TG_OP = 'INSERT' then 'oc_creada' else 'oc_actualizada' end;
    v_actor := NEW.creado_por;

  elsif TG_TABLE_NAME = 'formularios' then
    v_tipo  := 'formulario_recibido';
    v_actor := null;

  elsif TG_TABLE_NAME = 'profiles' then
    v_tipo  := case when TG_OP = 'INSERT' then 'perfil_creado' else 'perfil_actualizado' end;
    v_actor := NEW.id;

  else
    v_tipo := lower(TG_TABLE_NAME) || '_' || lower(TG_OP);
  end if;

  insert into eventos_sistema (tipo, entidad, entidad_id, payload, actor, bodega)
  values (v_tipo, TG_TABLE_NAME, NEW.id::text, to_jsonb(NEW), v_actor, v_bodega);

  return NEW;
end;
$$;

-- ===================== Triggers por tabla =====================

-- movimientos_inventario: solo INSERT (la tabla es inmutable, no hay UPDATE/DELETE)
drop trigger if exists trg_evento_movimientos on movimientos_inventario;
create trigger trg_evento_movimientos
  after insert on movimientos_inventario
  for each row execute function fn_registrar_evento_sistema();

-- ajustes_pendientes: creación y resolución (cambio real de estado, no cualquier update)
drop trigger if exists trg_evento_ajuste_creado on ajustes_pendientes;
create trigger trg_evento_ajuste_creado
  after insert on ajustes_pendientes
  for each row execute function fn_registrar_evento_sistema();

drop trigger if exists trg_evento_ajuste_resuelto on ajustes_pendientes;
create trigger trg_evento_ajuste_resuelto
  after update of estado on ajustes_pendientes
  for each row
  when (OLD.estado = 'pendiente' and NEW.estado <> 'pendiente')
  execute function fn_registrar_evento_sistema();

-- ordenes_compra: creación y cambios de estado
drop trigger if exists trg_evento_oc_creada on ordenes_compra;
create trigger trg_evento_oc_creada
  after insert on ordenes_compra
  for each row execute function fn_registrar_evento_sistema();

drop trigger if exists trg_evento_oc_actualizada on ordenes_compra;
create trigger trg_evento_oc_actualizada
  after update of estado on ordenes_compra
  for each row
  when (OLD.estado is distinct from NEW.estado)
  execute function fn_registrar_evento_sistema();

-- formularios: cada ingreso nuevo (coexiste con el trigger de sync VIN de 015, no lo reemplaza)
drop trigger if exists trg_evento_formulario on formularios;
create trigger trg_evento_formulario
  after insert on formularios
  for each row execute function fn_registrar_evento_sistema();

-- profiles: alta de usuario y cambios de rol/activo (activación-desactivación, cambio de rol)
drop trigger if exists trg_evento_perfil_creado on profiles;
create trigger trg_evento_perfil_creado
  after insert on profiles
  for each row execute function fn_registrar_evento_sistema();

drop trigger if exists trg_evento_perfil_actualizado on profiles;
create trigger trg_evento_perfil_actualizado
  after update of rol, activo on profiles
  for each row
  when (OLD.rol is distinct from NEW.rol or OLD.activo is distinct from NEW.activo)
  execute function fn_registrar_evento_sistema();
