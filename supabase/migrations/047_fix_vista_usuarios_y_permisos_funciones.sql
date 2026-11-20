-- 047: correcciones detectadas al aplicar 031-046 contra el proyecto cloud real.
--
-- 1) vista_usuarios_panel quedó en producción con security_invoker=on, aunque
--    030 la definía con security_invoker=false. Con invoker=on la vista corre
--    con los permisos del usuario autenticado, que NO puede leer auth.users:
--    "permission denied for table users" -> la pantalla Usuarios quedaba vacía.
--    Se fuerza la opción de forma explícita (ALTER VIEW ... SET), que sí
--    reemplaza la reloption aunque la vista ya exista.
--
-- 2) Este proyecto tiene ALTER DEFAULT PRIVILEGES que otorgan EXECUTE a
--    anon/authenticated sobre TODA función nueva del schema public. Las
--    funciones internas de la Sección 2 (035-046) se diseñaron para llamarse
--    solo desde triggers, pg_cron o Edge Functions con service_role, pero por
--    esos defaults quedaban expuestas vía PostgREST (/rest/v1/rpc/...). En
--    particular fn_service_role_key() devolvería la clave service_role del
--    Vault a cualquier usuario del panel. Se revoca EXECUTE a public/anon/
--    authenticated y se deja solo a service_role (y al dueño, postgres, que
--    es quien corre pg_cron y los triggers SECURITY DEFINER).
--
-- 3) Las tablas/vistas nuevas también reciben por defecto todos los
--    privilegios para anon. RLS ya bloquea (no hay policies para anon), pero
--    se revoca explícitamente para que el rol anon no tenga ni el GRANT.

-- ===================== 1) vista_usuarios_panel =====================
alter view public.vista_usuarios_panel set (security_invoker = false);

-- Las vistas de 036 y 041 dependen de correr como dueño (filtran por rol con
-- get_user_rol() dentro de la propia vista). Se deja explícito por si en el
-- futuro un linter o un cambio manual las pasa a invoker.
alter view public.vista_log_automatizaciones_ultimo_estado set (security_invoker = false);
alter view public.vista_movimientos_por_dia        set (security_invoker = false);
alter view public.vista_stock_por_bodega           set (security_invoker = false);
alter view public.vista_stock_por_categoria        set (security_invoker = false);
alter view public.vista_top_productos              set (security_invoker = false);
alter view public.vista_vehiculos_por_etapa        set (security_invoker = false);
alter view public.vista_ajustes_por_estado         set (security_invoker = false);
alter view public.vista_oc_por_estado              set (security_invoker = false);
alter view public.vista_tendencia_valorizacion     set (security_invoker = false);

-- ===================== 2) funciones internas: solo service_role =====================
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as firma
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (
        'fn_service_role_key',
        'fn_functions_base_url',
        'fn_llamar_edge_function',
        'fn_crear_notificacion',
        'fn_encolar_correo',
        'fn_log_automatizacion_iniciar',
        'fn_log_automatizacion_cerrar',
        'fn_encolar_sync_pendiente',
        'fn_registrar_intento_sync',
        'fn_cierre_diario_kpi',
        'fn_recordatorio_ajustes_pendientes',
        'fn_aviso_oc_vencidas',
        'fn_reintentar_sync_pendientes',
        'fn_disparar_envio_correos',
        'fn_disparar_catalogo_siigo',
        'fn_limpiar_notificaciones_leidas'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.firma);
    execute format('grant execute on function %s to service_role', r.firma);
  end loop;
end $$;

-- RPCs que SÍ usa el panel (authenticated), pero que anon no debe ver.
revoke all on function public.marcar_notificacion_leida(bigint) from public, anon;
revoke all on function public.marcar_todas_leidas()             from public, anon;
revoke all on function public.rpc_kpis_dashboard()              from public, anon;
revoke all on function public.rpc_aprobar_oc_siigo(bigint)      from public, anon;

-- ===================== 3) anon sin acceso a lo nuevo =====================
revoke all on table
  public.eventos_sistema,
  public.notificaciones,
  public.alertas_stock_bajo,
  public.sync_pendientes,
  public.log_automatizaciones,
  public.cola_correos,
  public.kpi_diario,
  public.siigo_catalogo_diferencias
from anon;

revoke all on
  public.vista_log_automatizaciones_ultimo_estado,
  public.vista_movimientos_por_dia,
  public.vista_stock_por_bodega,
  public.vista_stock_por_categoria,
  public.vista_top_productos,
  public.vista_vehiculos_por_etapa,
  public.vista_ajustes_por_estado,
  public.vista_oc_por_estado,
  public.vista_tendencia_valorizacion
from anon;

-- Las Edge Functions (service_role) escriben directo en estas tablas
-- (cola_correos, siigo_catalogo_diferencias, sync_pendientes...). Los
-- defaults del proyecto ya lo cubren, pero se deja explícito como en 014.
grant all on table
  public.eventos_sistema,
  public.notificaciones,
  public.alertas_stock_bajo,
  public.sync_pendientes,
  public.log_automatizaciones,
  public.cola_correos,
  public.kpi_diario,
  public.siigo_catalogo_diferencias
to service_role;
