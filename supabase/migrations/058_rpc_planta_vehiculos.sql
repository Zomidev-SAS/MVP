-- 058: datos de vehículos para el modo pantalla de planta (/planta/[token]).
--
-- La vista "Vehículos por etapa" de la TV permite elegir un vehículo y ver su
-- línea de tiempo (solo lectura). La TV no tiene sesión, así que, igual que
-- rpc_datos_planta (048), estos RPC exigen el token firmado de planta y lo
-- verifican con fn_verificar_token_planta contra el secreto del Vault.
--
-- Solo los llama el servidor de Next.js (nunca el navegador de la TV), que
-- ya filtra y deriva los datos antes de enviarlos al cliente.

create or replace function rpc_planta_formularios(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not fn_verificar_token_planta(p_token) then
    raise exception 'Token de planta inválido o vencido' using errcode = '28000';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(f))
    from (
      select *
      from formularios
      order by created_at desc nulls last
      limit 2000
    ) f
  ), '[]'::jsonb);
end;
$$;

create or replace function rpc_planta_procesos_vehiculo(p_token text, p_chasis text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not fn_verificar_token_planta(p_token) then
    raise exception 'Token de planta inválido o vencido' using errcode = '28000';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', id,
             'chasis', chasis,
             'titulo', titulo,
             'proceso_estado', proceso_estado,
             'observaciones', observaciones,
             'seccion_siguiente', seccion_siguiente,
             'creado_por_nombre', creado_por_nombre,
             'creado_en', creado_en
           ) order by creado_en)
    from vehiculo_procesos
    where chasis = p_chasis
  ), '[]'::jsonb);
end;
$$;

revoke all on function rpc_planta_formularios(text)              from public;
revoke all on function rpc_planta_procesos_vehiculo(text, text)  from public;
grant execute on function rpc_planta_formularios(text)             to anon, authenticated, service_role;
grant execute on function rpc_planta_procesos_vehiculo(text, text) to anon, authenticated, service_role;
