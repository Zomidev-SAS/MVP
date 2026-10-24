-- 048: datos para el modo pantalla de planta (/planta/[token], TV del taller).
--
-- La TV no tiene sesión: el panel llama este RPC con el cliente anon. Como la
-- anon key es pública (va en el bundle del navegador), un simple GRANT a anon
-- dejaría estos datos abiertos a cualquiera. Por eso el RPC exige el MISMO
-- token que firma el panel (generarTokenPlanta, HS256 con PLANTA_KIOSK_SECRET)
-- y verifica aquí su firma, su expiración y su tipo contra el secreto guardado
-- en el Vault con el nombre 'PLANTA_KIOSK_SECRET'. Ambos valores (Vault y
-- docker/.env del VPS) tienen que ser idénticos.
--
-- Solo devuelve datos operativos sin dinero: vehículos por etapa, conteo de
-- entradas/salidas de los últimos 7 días y productos en stock bajo. Nunca
-- agregar aquí valor_unitario, valor_total ni nada monetario.

create or replace function fn_base64url_decode(p_input text)
returns bytea
language sql
immutable
set search_path = public
as $$
  select decode(
    rpad(
      translate(p_input, '-_', '+/'),
      length(p_input) + (4 - length(p_input) % 4) % 4,
      '='
    ),
    'base64'
  );
$$;

create or replace function fn_verificar_token_planta(p_token text)
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

  -- Sin secreto configurado se falla cerrado, igual que planta-actions.ts.
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

  return v_payload->>'tipo' = 'planta-kiosk'
     and (v_payload->>'exp') is not null
     and (v_payload->>'exp')::bigint > extract(epoch from now())::bigint;
exception when others then
  -- Token malformado (base64/JSON inválido): nunca propagar el error.
  return false;
end;
$$;

create or replace function rpc_datos_planta(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_umbral    integer;
  v_hoy       date := (now() at time zone 'America/Bogota')::date;
  v_resultado jsonb;
begin
  if not fn_verificar_token_planta(p_token) then
    raise exception 'Token de planta inválido o vencido' using errcode = '28000';
  end if;

  select umbral_stock_bajo into v_umbral from config_app where id = 1;
  v_umbral := coalesce(v_umbral, 2);

  select jsonb_build_object(
    'vehiculos_por_etapa', coalesce((
      select jsonb_agg(jsonb_build_object('etapa', etapa, 'cantidad', vehiculos) order by vehiculos desc)
      from (
        select proceso_estado as etapa, count(*) as vehiculos
        from (
          select distinct on (chasis) chasis, proceso_estado
          from vehiculo_procesos
          order by chasis, creado_en desc
        ) ultimos
        group by proceso_estado
      ) etapas
    ), '[]'::jsonb),

    -- Mismo criterio que getDashboardData: últimos 7 días en hora de Bogotá,
    -- contando movimientos aplicados (no unidades).
    'entradas_salidas', (
      select jsonb_agg(jsonb_build_object(
               'fecha', to_char(d.dia, 'YYYY-MM-DD'),
               'entradas', coalesce(m.entradas, 0),
               'salidas', coalesce(m.salidas, 0)
             ) order by d.dia)
      from generate_series(v_hoy - 6, v_hoy, interval '1 day') as d(dia)
      left join (
        select (created_at at time zone 'America/Bogota')::date as dia,
               count(*) filter (where tipo_movimiento = 'entrada')    as entradas,
               count(*) filter (where tipo_movimiento = 'salida_vin') as salidas
        from movimientos_inventario
        where estado = 'aplicado'
          and tipo_movimiento in ('entrada', 'salida_vin')
          and created_at >= ((v_hoy - 6)::timestamp at time zone 'America/Bogota')
        group by 1
      ) m on m.dia = d.dia::date
    ),

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
        limit 10
      ) bajos
    ), '[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end;
$$;

-- Defaults del proyecto otorgan EXECUTE a todos (ver 047): se deja explícito.
revoke all on function fn_base64url_decode(text)       from public, anon, authenticated;
revoke all on function fn_verificar_token_planta(text) from public, anon, authenticated;
revoke all on function rpc_datos_planta(text)          from public;
grant execute on function fn_base64url_decode(text)       to service_role;
grant execute on function fn_verificar_token_planta(text) to service_role;
grant execute on function rpc_datos_planta(text)          to anon, authenticated, service_role;
