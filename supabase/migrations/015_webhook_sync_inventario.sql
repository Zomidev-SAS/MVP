-- B1: webhook vehiculosapp → sync-inventario-vin
-- vehiculosapp usa tipo_formulario + dg_chasis (no tipo + data JSON del stub local).

create extension if not exists pg_net;

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
begin
  -- vehiculosapp: tipo_formulario = 'ingreso'
  if coalesce(new.tipo_formulario, new.tipo) is distinct from 'ingreso' then
    return new;
  end if;

  -- vehiculosapp: columna dg_chasis; fallback JSON del stub local
  chasis := coalesce(
    nullif(trim(new.dg_chasis), ''),
    nullif(trim(new.data -> 'datosGenerales' ->> 'chasis'), '')
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

drop trigger if exists on_formulario_ingreso on formularios;
create trigger on_formulario_ingreso
  after insert on formularios
  for each row
  execute function trigger_sync_inventario_vin();
