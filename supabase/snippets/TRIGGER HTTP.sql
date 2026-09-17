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
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
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