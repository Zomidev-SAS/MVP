-- B5: Tareas programadas con pg_cron.
-- Todas las funciones que corren por cron registran su ejecución en
-- log_automatizaciones (036), que es lo que pide el criterio de aceptación
-- de B5 y lo que muestra la pantalla de Automatizaciones (B8).

create extension if not exists pg_cron;

-- ===================== 8:00 a.m.: recordatorios =====================
create or replace function fn_recordatorio_ajustes_pendientes()
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
  v_log_id := fn_log_automatizacion_iniciar('recordatorio_ajustes_pendientes');

  for v_rec in
    select id from ajustes_pendientes
    where estado = 'pendiente' and created_at < now() - interval '24 hours'
  loop
    perform fn_crear_notificacion(
      p_tipo        => 'ajuste_recordatorio',
      p_titulo      => 'Ajuste pendiente hace más de 24 horas',
      p_mensaje     => 'El ajuste #' || v_rec.id || ' sigue sin resolverse.',
      p_enlace      => '/ajustes/' || v_rec.id,
      p_rol_destino => 'supervisor'
    );
    v_n := v_n + 1;
  end loop;

  perform fn_log_automatizacion_cerrar(v_log_id, 'ok', v_n);
exception when others then
  perform fn_log_automatizacion_cerrar(v_log_id, 'error', v_n, sqlerrm);
end;
$$;

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
    select id, titulo from ordenes_compra
    where estado not in ('listo', 'cancelada')
      and fecha_vencimiento is not null and fecha_vencimiento < current_date
  loop
    perform fn_crear_notificacion(
      p_tipo        => 'oc_vencida',
      p_titulo      => 'Orden de compra vencida',
      p_mensaje     => 'La orden "' || coalesce(v_rec.titulo, 'OC ' || v_rec.id) || '" venció y sigue sin cerrarse.',
      p_enlace      => '/compras/' || v_rec.id,
      p_rol_destino => 'compras'
    );
    v_n := v_n + 1;
  end loop;

  perform fn_log_automatizacion_cerrar(v_log_id, 'ok', v_n);
exception when others then
  perform fn_log_automatizacion_cerrar(v_log_id, 'error', v_n, sqlerrm);
end;
$$;

-- ===================== Cada 5 min: reintentos VIN y Siigo =====================
-- La lógica de reintento real (volver a llamar sync-inventario-vin /
-- siigo-sync-oc) vive en las Edge Functions; esta función solo dispara la
-- llamada para cada fila vencida de sync_pendientes vía fn_llamar_edge_function.
create or replace function fn_reintentar_sync_pendientes()
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
  v_log_id := fn_log_automatizacion_iniciar('reintentar_sync_pendientes');

  for v_rec in
    select * from sync_pendientes
    where estado = 'pendiente' and proximo_intento <= now()
    order by proximo_intento
    limit 50
  loop
    update sync_pendientes set estado = 'reintentando' where id = v_rec.id;

    if v_rec.tipo = 'sync_vin' then
      perform fn_llamar_edge_function('sync-inventario-vin', v_rec.payload || jsonb_build_object('sync_pendiente_id', v_rec.id));
    elsif v_rec.tipo = 'siigo_oc' then
      perform fn_llamar_edge_function('siigo-sync-oc', v_rec.payload || jsonb_build_object('sync_pendiente_id', v_rec.id));
    elsif v_rec.tipo = 'siigo_catalogo' then
      perform fn_llamar_edge_function('siigo-sync-catalogo', v_rec.payload || jsonb_build_object('sync_pendiente_id', v_rec.id));
    end if;

    v_n := v_n + 1;
  end loop;

  perform fn_log_automatizacion_cerrar(v_log_id, 'ok', v_n);
exception when others then
  perform fn_log_automatizacion_cerrar(v_log_id, 'error', v_n, sqlerrm);
end;
$$;

-- ===================== Cada minuto: envío de la cola de correos =====================
create or replace function fn_disparar_envio_correos()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pendientes integer;
begin
  select count(*) into v_pendientes from cola_correos where estado = 'pendiente';
  if v_pendientes > 0 then
    perform fn_llamar_edge_function('enviar-correos', '{}'::jsonb);
  end if;
end;
$$;

-- ===================== Cada noche: catálogo Siigo =====================
create or replace function fn_disparar_catalogo_siigo()
returns void
language sql
security definer
set search_path = public
as $$
  select fn_llamar_edge_function('siigo-sync-catalogo', jsonb_build_object('origen', 'cron_nocturno'));
$$;

-- ===================== Semanal: limpieza de notificaciones leídas > 90 días =====================
create or replace function fn_limpiar_notificaciones_leidas()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id bigint;
  v_n integer;
begin
  v_log_id := fn_log_automatizacion_iniciar('limpiar_notificaciones_leidas');

  delete from notificaciones
  where leida = true and leida_at < now() - interval '90 days';
  get diagnostics v_n = row_count;

  perform fn_log_automatizacion_cerrar(v_log_id, 'ok', v_n);
exception when others then
  perform fn_log_automatizacion_cerrar(v_log_id, 'error', 0, sqlerrm);
end;
$$;

-- ===================== Programación =====================
-- Se usa cron.schedule con 'unschedule' previo (por nombre) para que la
-- migración sea reaplicable sin duplicar jobs.
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'cierre_diario_kpi';
  perform cron.unschedule(jobid) from cron.job where jobname = 'recordatorio_ajustes_pendientes';
  perform cron.unschedule(jobid) from cron.job where jobname = 'aviso_oc_vencidas';
  perform cron.unschedule(jobid) from cron.job where jobname = 'reintentar_sync_pendientes';
  perform cron.unschedule(jobid) from cron.job where jobname = 'disparar_envio_correos';
  perform cron.unschedule(jobid) from cron.job where jobname = 'catalogo_siigo_nocturno';
  perform cron.unschedule(jobid) from cron.job where jobname = 'limpiar_notificaciones_leidas';
exception when others then
  null; -- si cron.job no existe todavía (primera aplicación), no hay nada que desprogramar
end $$;

select cron.schedule('cierre_diario_kpi',              '55 23 * * *', $$select fn_cierre_diario_kpi();$$);
select cron.schedule('recordatorio_ajustes_pendientes', '0 8 * * *',   $$select fn_recordatorio_ajustes_pendientes();$$);
select cron.schedule('aviso_oc_vencidas',                '5 8 * * *',   $$select fn_aviso_oc_vencidas();$$);
select cron.schedule('reintentar_sync_pendientes',       '*/5 * * * *', $$select fn_reintentar_sync_pendientes();$$);
select cron.schedule('disparar_envio_correos',           '* * * * *',   $$select fn_disparar_envio_correos();$$);
select cron.schedule('catalogo_siigo_nocturno',          '30 2 * * *',  $$select fn_disparar_catalogo_siigo();$$);
select cron.schedule('limpiar_notificaciones_leidas',    '0 3 * * 1',   $$select fn_limpiar_notificaciones_leidas();$$);
