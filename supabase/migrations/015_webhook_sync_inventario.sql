-- 015_webhook_sync_inventario.sql
-- B1: dispara sync-inventario-vin automáticamente al insertar un formulario
-- de tipo 'ingreso' con chasis (codigo_producto) no vacío.
--
-- Nota: la service_role_key va escrita directo en la función porque
-- Postgres local no permite crear parámetros personalizados con
-- ALTER DATABASE ... SET (permission denied incluso como superusuario).
-- Es seguro porque el código de la función solo es visible dentro de
-- esta misma base de datos. En producción (B10) esto se resuelve con
-- Supabase Vault en vez de un literal.

create extension if not exists pg_net;

create or replace function trigger_sync_inventario_vin()
returns trigger
language plpgsql
security definer
as $$
declare
  chasis text;
begin
  -- Solo procesar formularios de tipo 'ingreso'
  if new.tipo is distinct from 'ingreso' then
    return new;
  end if;

  -- Extraer el chasis (codigo_producto) del JSON, tal como indica
  -- el documento: formularios.data->'datosGenerales'->>'chasis'
  chasis := new.data -> 'datosGenerales' ->> 'chasis';

  if chasis is null or trim(chasis) = '' then
    return new;  -- sin chasis, no hay nada que sincronizar
  end if;

  perform net.http_post(
    url := 'http://host.docker.internal:54321/functions/v1/sync-inventario-vin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer REEMPLAZAR_CON_TU_SERVICE_ROLE_KEY_LOCAL'
    ),
    body := jsonb_build_object(
      'formulario_id', new.id,
      'codigo_producto', chasis,
      'bodega', coalesce(new.data ->> 'bodega', 'Sin Asignar')
    )
  );

  return new;
end;
$$;

create trigger on_formulario_ingreso
  after insert on formularios
  for each row
  execute function trigger_sync_inventario_vin();

-- NOTA DE SEGURIDAD: esta migración queda con un placeholder a propósito.
-- Cada desarrollador debe correr, DESPUÉS de aplicar las migraciones,
-- el siguiente UPDATE con su propia service_role_key local (que se obtiene
-- con `supabase status`). Ese comando NO se versiona en git.
--
-- update pg_proc set prosrc = replace(prosrc, 'REEMPLAZAR_CON_TU_SERVICE_ROLE_KEY_LOCAL', 'TU_KEY_AQUI')
-- where proname = 'trigger_sync_inventario_vin';