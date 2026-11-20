-- Utilidades compartidas por toda la Sección 2 (B1-B14): cómo llamar a una
-- Edge Function desde SQL (triggers y pg_cron) sin nunca escribir una clave
-- en texto plano en una migración.
--
-- IMPORTANTE (lección del push bloqueado en el Avance 1): la service_role_key
-- NUNCA se escribe literal en un archivo .sql. Se lee de Supabase Vault
-- (vault.decrypted_secrets) tanto en local como en cloud — hay que cargarla
-- una vez en el Vault de cada entorno (ver docs/CONTRATO_DATOS_SECCION2.md).
--
-- OJO: cuál URL usar (local vs. cloud) se decide con un secreto DISTINTO
-- ('FUNCTIONS_BASE_URL'), no con si la service_role_key existe o no. Si se
-- decidiera por la presencia de la service_role_key, el día que cargues tu
-- service_role_key LOCAL en el Vault local para poder probar esto (paso
-- normal de pruebas), el sistema creería que ya está en cloud y tus pruebas
-- locales intentarían llamar a las Edge Functions de PRODUCCIÓN con tu clave
-- local — fallarían, o peor, confundirían cloud con local. Por eso van
-- separados: la key siempre sale del Vault; la URL sale de este otro secreto,
-- que en local simplemente no existe.

create extension if not exists pg_net;

create or replace function fn_service_role_key()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'SUPABASE_SERVICE_ROLE_KEY'
  limit 1;

  return coalesce(v_key, 'REEMPLAZAR_CON_TU_SERVICE_ROLE_KEY_LOCAL');
end;
$$;

create or replace function fn_functions_base_url()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'FUNCTIONS_BASE_URL'
  limit 1;

  -- Cloud: se carga explícitamente este secreto en el Vault (ver paso a paso
  -- de despliegue). Local: nunca se carga, así que siempre cae al default de
  -- Docker, sin importar qué otros secretos tenga el Vault local.
  return coalesce(v_url, 'http://host.docker.internal:54321/functions/v1');
end;
$$;

-- Wrapper único para invocar cualquier Edge Function desde un trigger o un
-- cron job, dejando rastro en log_automatizaciones (tabla creada en 036;
-- si todavía no existe —al aplicar este archivo antes que 036 en un entorno
-- viejo— simplemente no deja rastro, no falla la llamada).
create or replace function fn_llamar_edge_function(p_funcion text, p_body jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url     := fn_functions_base_url() || '/' || p_funcion,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || fn_service_role_key()
               ),
    body    := p_body
  );
exception when others then
  -- Nunca tumbar el trigger/cron que originó la llamada por un fallo de red.
  if to_regclass('public.log_automatizaciones') is not null then
    insert into log_automatizaciones (regla, inicio, fin, resultado, error)
    values ('fn_llamar_edge_function:' || p_funcion, now(), now(), 'error', sqlerrm);
  end if;
end;
$$;
