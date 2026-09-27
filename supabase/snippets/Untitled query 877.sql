update profiles set activo = true where id = 'fa8496d0-2409-4491-a9fd-8aa4c43748df';
select banned_until from auth.users where id = 'fa8496d0-2409-4491-a9fd-8aa4c43748df';

create or replace function trigger_sync_inventario_vin()
returns trigger
language plpgsql
security definer
as $$
declare
  chasis text;
begin
  if new.tipo is distinct from 'ingreso' then
    return new;
  end if;

  chasis := new.data -> 'datosGenerales' ->> 'chasis';

  if chasis is null or trim(chasis) = '' then
    return new;
  end if;

  perform net.http_post(
    url := 'http://host.docker.internal:54321/functions/v1/sync-inventario-vin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
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