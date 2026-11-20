-- 067: recordatorio diario de órdenes de compra sin firmar.
--
-- Al subir una OC de Siigo se avisa una sola vez a los supervisores. Si pasan
-- 24 horas sin firmarse, cada mañana (8:00 a. m. Colombia = 13:00 UTC) llega un
-- resumen con las pendientes. Una sola notificación por supervisor, no una por
-- orden, para no llenar el correo.

create or replace function fn_recordatorio_oc_pendientes_firma()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id bigint;
  v_total  integer;
  v_lista  text;
begin
  v_log_id := fn_log_automatizacion_iniciar('recordatorio_firma_oc');

  select count(*),
         string_agg(coalesce(numero_oc, '#' || id), ', ' order by created_at)
    into v_total, v_lista
  from (
    select id, numero_oc, created_at
    from ordenes_compra
    where estado = 'en_curso'
      and documento_path is not null
      and firmada_at is null
      and created_at < now() - interval '24 hours'
    order by created_at
    limit 8
  ) p;

  -- El total real puede ser mayor que las 8 que se listan.
  select count(*) into v_total
  from ordenes_compra
  where estado = 'en_curso'
    and documento_path is not null
    and firmada_at is null
    and created_at < now() - interval '24 hours';

  if v_total > 0 then
    perform fn_crear_notificacion(
      p_tipo        => 'oc_pendiente_firma',
      p_titulo      => case when v_total = 1 then '1 orden de compra sin firmar'
                            else v_total || ' órdenes de compra sin firmar' end,
      p_mensaje     => 'Llevan más de 24 horas esperando la firma: ' || v_lista
                       || case when v_total > 8 then ' y otras más.' else '.' end,
      p_enlace      => '/compras',
      p_rol_destino => 'supervisor'
    );
  end if;

  perform fn_log_automatizacion_cerrar(v_log_id, 'ok', v_total);
exception when others then
  perform fn_log_automatizacion_cerrar(v_log_id, 'error', 0, sqlerrm);
end;
$$;

revoke all on function fn_recordatorio_oc_pendientes_firma() from public, anon, authenticated;
grant execute on function fn_recordatorio_oc_pendientes_firma() to service_role;

select cron.schedule(
  'recordatorio_firma_oc',
  '0 13 * * *',
  $$select fn_recordatorio_oc_pendientes_firma();$$
);

-- El aviso de OC vencidas mostraba "OC 12" para las órdenes sin título (las que
-- vienen de Siigo) y enlazaba a una ruta que no existe (/compras/12).
create or replace function fn_aviso_oc_vencidas()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id bigint;
  v_rec    record;
  v_n      integer := 0;
begin
  v_log_id := fn_log_automatizacion_iniciar('aviso_oc_vencidas');

  for v_rec in
    select id, titulo, numero_oc from ordenes_compra
    where estado not in ('listo', 'cancelada')
      and fecha_vencimiento is not null and fecha_vencimiento < current_date
  loop
    perform fn_crear_notificacion(
      p_tipo        => 'oc_vencida',
      p_titulo      => 'Orden de compra vencida',
      p_mensaje     => 'La orden "' || coalesce(v_rec.titulo, v_rec.numero_oc, 'OC ' || v_rec.id)
                       || '" venció y sigue sin cerrarse.',
      p_enlace      => '/compras',
      p_rol_destino => 'compras'
    );
    v_n := v_n + 1;
  end loop;

  perform fn_log_automatizacion_cerrar(v_log_id, 'ok', v_n);
exception when others then
  perform fn_log_automatizacion_cerrar(v_log_id, 'error', v_n, sqlerrm);
end;
$$;

revoke all on function fn_aviso_oc_vencidas() from public, anon, authenticated;
grant execute on function fn_aviso_oc_vencidas() to service_role;
