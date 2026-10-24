-- 065: permitir descartar errores viejos de la pantalla Automatizaciones.
--
-- La pantalla muestra el ÚLTIMO registro de cada regla
-- (vista_log_automatizaciones_ultimo_estado). Para reglas que no corren sobre
-- un horario (p. ej. siigo_sync_oc, solo al marcar una OC como lista), un error
-- de pruebas viejo se quedaba como "estado actual" para siempre.
-- Un error descartado sigue en el historial de log_automatizaciones, pero deja
-- de aparecer como estado actual.

alter table log_automatizaciones
  add column if not exists descartado_at timestamptz;

create or replace view vista_log_automatizaciones_ultimo_estado as
select distinct on (regla)
  regla,
  id,
  inicio,
  fin,
  resultado,
  filas_afectadas,
  error,
  extract(epoch from fin - inicio) as duracion_segundos
from log_automatizaciones
where get_user_rol() = any (array['supervisor', 'auditoria'])
  and not (resultado = 'error' and descartado_at is not null)
order by regla, inicio desc;

alter view vista_log_automatizaciones_ultimo_estado set (security_invoker = true);
grant select on vista_log_automatizaciones_ultimo_estado to authenticated;
revoke all on vista_log_automatizaciones_ultimo_estado from anon;

-- Errores ya resueltos: las pruebas de envío de la OC 1 (cancelada; causa
-- provider_invoice corregida en 064) y las bajadas de catálogo que se cortaban
-- por tiempo (función reescrita, ahora termina en segundos).
update log_automatizaciones
set descartado_at = now()
where resultado = 'error'
  and descartado_at is null
  and (
    (regla = 'siigo_sync_oc' and error like 'Siigo purchases (400)%')
    or (regla = 'siigo_sync_catalogo' and error like 'Interrumpida:%')
  );
