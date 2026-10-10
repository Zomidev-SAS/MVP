-- B8: Registro de automatizaciones. Toda regla automática (triggers, tareas
-- programadas, reintentos, Siigo, correos) deja aquí un rastro verificable
-- desde el panel, sin tener que entrar a los logs de Supabase.

create table if not exists log_automatizaciones (
  id              bigint generated always as identity primary key,
  regla           text not null,
  inicio          timestamptz not null default now(),
  fin             timestamptz,
  resultado       text not null default 'en_curso'
                    check (resultado in ('en_curso', 'ok', 'error')),
  filas_afectadas integer,
  error           text,
  detalle         jsonb
);

create index if not exists idx_log_automatizaciones_regla_inicio
  on log_automatizaciones(regla, inicio desc);
create index if not exists idx_log_automatizaciones_resultado
  on log_automatizaciones(resultado);

alter table log_automatizaciones enable row level security;

drop policy if exists log_automatizaciones_select on log_automatizaciones;
create policy log_automatizaciones_select on log_automatizaciones
  for select using (get_user_rol() in ('supervisor', 'auditoria'));

grant select on log_automatizaciones to authenticated;

-- Helpers para que triggers y Edge Functions registren una ejecución en dos
-- pasos (abrir -> cerrar), sin repetir el INSERT/UPDATE en cada sitio.
create or replace function fn_log_automatizacion_iniciar(p_regla text, p_detalle jsonb default null)
returns bigint
language sql
security definer
set search_path = public
as $$
  insert into log_automatizaciones (regla, inicio, resultado, detalle)
  values (p_regla, now(), 'en_curso', p_detalle)
  returning id;
$$;

create or replace function fn_log_automatizacion_cerrar(
  p_id bigint,
  p_resultado text,
  p_filas_afectadas integer default null,
  p_error text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update log_automatizaciones
  set fin = now(), resultado = p_resultado,
      filas_afectadas = p_filas_afectadas, error = p_error
  where id = p_id;
$$;

-- Vista de último estado por regla (para la pantalla de Automatizaciones).
-- Como la vista corre con los permisos del dueño (no security_invoker), el
-- RLS de log_automatizaciones no se aplica solo: replicamos aquí el mismo
-- filtro por rol para que un usuario sin permiso no vea nada a través de ella.
create or replace view vista_log_automatizaciones_ultimo_estado as
select distinct on (regla)
  regla, id, inicio, fin, resultado, filas_afectadas, error,
  extract(epoch from (fin - inicio)) as duracion_segundos
from log_automatizaciones
where get_user_rol() in ('supervisor', 'auditoria')
order by regla, inicio desc;

grant select on vista_log_automatizaciones_ultimo_estado to authenticated;
