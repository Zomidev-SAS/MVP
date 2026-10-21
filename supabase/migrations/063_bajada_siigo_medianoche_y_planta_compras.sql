-- 063: bajada nocturna de Siigo a las 12 a. m. (Colombia) y modo planta de compras.
--
-- 1) pg_cron corre en UTC: el job estaba en '30 2 * * *' (9:30 p. m. en
--    Colombia). La medianoche en Bogotá (UTC-5, sin horario de verano) es
--    05:00 UTC. Además se cierran las ejecuciones que quedaron "en curso" para
--    siempre porque la función superaba el tiempo máximo.
-- 2) Modo planta de compras: la TV de compras no tiene sesión y se protege con
--    el mismo esquema de token firmado que /planta (fn_verificar_token_planta),
--    pero con tipo propio ('planta-compras') para que un token de la TV del
--    taller no sirva aquí ni al revés. Solo devuelve datos operativos: nunca
--    precios ni valores.

-- ===================== 1) horario y ejecuciones colgadas =====================
select cron.alter_job(
  job_id   => (select jobid from cron.job where jobname = 'catalogo_siigo_nocturno'),
  schedule => '0 5 * * *'
);

update log_automatizaciones
set resultado = 'error',
    fin = now(),
    error = 'Interrumpida: la función superó el tiempo máximo antes de terminar'
where regla = 'siigo_sync_catalogo'
  and resultado = 'en_curso'
  and inicio < now() - interval '1 hour';

-- ===================== 2) token por tipo =====================
create or replace function fn_verificar_token_planta_tipo(p_token text, p_tipo text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_secret  text;
  v_partes  text[];
  v_firma   text;
  v_payload jsonb;
begin
  if p_token is null or length(p_token) > 2048 then
    return false;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'PLANTA_KIOSK_SECRET'
  limit 1;

  if v_secret is null or length(v_secret) < 16 then
    return false;
  end if;

  v_partes := string_to_array(p_token, '.');
  if array_length(v_partes, 1) <> 3 then
    return false;
  end if;

  if (convert_from(fn_base64url_decode(v_partes[1]), 'utf8')::jsonb)->>'alg' <> 'HS256' then
    return false;
  end if;

  v_firma := rtrim(
    translate(
      encode(extensions.hmac(v_partes[1] || '.' || v_partes[2], v_secret, 'sha256'), 'base64'),
      '+/', '-_'
    ),
    '='
  );
  if v_firma <> v_partes[3] then
    return false;
  end if;

  v_payload := convert_from(fn_base64url_decode(v_partes[2]), 'utf8')::jsonb;

  return v_payload->>'tipo' = p_tipo
     and (v_payload->>'exp') is not null
     and (v_payload->>'exp')::bigint > extract(epoch from now())::bigint;
exception when others then
  return false;
end;
$$;

-- El verificador original (048) pasa a ser un caso del genérico.
create or replace function fn_verificar_token_planta(p_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select fn_verificar_token_planta_tipo(p_token, 'planta-kiosk');
$$;

revoke all on function fn_verificar_token_planta_tipo(text, text) from public, anon, authenticated;
revoke all on function fn_verificar_token_planta(text) from public, anon, authenticated;
grant execute on function fn_verificar_token_planta_tipo(text, text) to service_role;
grant execute on function fn_verificar_token_planta(text) to service_role;

-- ===================== 3) datos de la TV de compras =====================
create or replace function rpc_planta_compras(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_umbral integer;
  v_hoy    date := (now() at time zone 'America/Bogota')::date;
begin
  if not fn_verificar_token_planta_tipo(p_token, 'planta-compras') then
    raise exception 'Token de planta (compras) inválido o vencido' using errcode = '28000';
  end if;

  select umbral_stock_bajo into v_umbral from config_app where id = 1;
  v_umbral := coalesce(v_umbral, 2);

  return jsonb_build_object(
    'kpis', jsonb_build_object(
      'en_curso', (select count(*) from ordenes_compra where estado = 'en_curso'),
      'vencidas', (select count(*) from ordenes_compra
                   where estado = 'en_curso' and fecha_vencimiento is not null and fecha_vencimiento < v_hoy),
      'pendientes_firma', (select count(*) from ordenes_compra
                           where estado = 'en_curso' and documento_path is not null and firmada_at is null),
      'con_entregas_parciales', (
        select count(*) from ordenes_compra o
        where o.estado = 'en_curso'
          and exists (
            select 1 from orden_compra_items i
            where i.orden_id = o.id
              and coalesce(i.cantidad_recibida, 0) > 0
              and i.cantidad_recibida < i.cantidad
          )
      )
    ),

    'ordenes', coalesce((
      select jsonb_agg(t.fila order by t.vence nulls last, t.id)
      from (
        select
          o.id,
          o.fecha_vencimiento as vence,
          jsonb_build_object(
            'id', o.id,
            'numero', o.numero_oc,
            'proveedor', (select min(i.proveedor_nombre) from orden_compra_items i where i.orden_id = o.id),
            'fecha_pedido', o.fecha_pedido,
            'fecha_vencimiento', o.fecha_vencimiento,
            'requiere_firma', o.documento_path is not null,
            'firmada', o.firmada_at is not null,
            'pedidas', coalesce((select sum(i.cantidad) from orden_compra_items i where i.orden_id = o.id), 0),
            'recibidas', coalesce((select sum(coalesce(i.cantidad_recibida, 0)) from orden_compra_items i where i.orden_id = o.id), 0),
            'ultima_entrega', (select max(i.cantidad_recibida_at) from orden_compra_items i where i.orden_id = o.id)
          ) as fila
        from ordenes_compra o
        where o.estado = 'en_curso'
        order by o.fecha_vencimiento nulls last, o.id
        limit 24
      ) t
    ), '[]'::jsonb),

    'productos_stock_bajo', coalesce((
      select jsonb_agg(jsonb_build_object(
               'codigo_producto', codigo_producto,
               'nombre_producto', nombre_producto,
               'saldo', saldo
             ) order by saldo, codigo_producto)
      from (
        select codigo_producto, nombre_producto, saldo
        from vista_inventario_actual
        where saldo > 0 and saldo <= v_umbral
        order by saldo, codigo_producto
        limit 12
      ) bajos
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function rpc_planta_compras(text) from public;
grant execute on function rpc_planta_compras(text) to anon, authenticated, service_role;
