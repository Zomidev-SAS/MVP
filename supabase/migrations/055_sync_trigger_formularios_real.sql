-- Alinea el repo con la función que ya corre en el cloud.
-- 015 usaba new.tipo / new.data, columnas del stub local; la tabla real de
-- vehiculosapp tiene tipo_formulario y dg_chasis. Esta versión usa esas
-- columnas y, en cloud, lee la service_role_key del Vault (secreto
-- SUPABASE_SERVICE_ROLE_KEY). Es idempotente: en el cloud no cambia nada.
create or replace function trigger_sync_inventario_vin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chasis text;
  api_url text;
  service_key text;
  tipo text;
begin
  tipo := coalesce(
    nullif(trim(new.tipo_formulario), ''),
    nullif(trim(new.data->>'tipoFormulario'), ''),
    'ingreso'
  );

  if tipo is distinct from 'ingreso' then
    return new;
  end if;

  chasis := coalesce(
    nullif(trim(new.dg_chasis), ''),
    nullif(trim(new.data->'datosGenerales'->>'chasis'), '')
  );

  if chasis is null then
    return new;
  end if;

  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'SUPABASE_SERVICE_ROLE_KEY'
  limit 1;

  if service_key is not null then
    api_url := 'https://zkaeptnijqntuefggfru.supabase.co/functions/v1/sync-inventario-vin';
  else
    service_key := 'REEMPLAZAR_CON_TU_SERVICE_ROLE_KEY_LOCAL';
    api_url := 'http://host.docker.internal:54321/functions/v1/sync-inventario-vin';
  end if;

  perform net.http_post(
    url := api_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'formulario_id', new.id,
      'codigo_producto', chasis,
      'bodega', 'Sin Asignar'
    )
  );

  return new;
end;
$$;
