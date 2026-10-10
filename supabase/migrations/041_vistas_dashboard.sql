-- B6: Vistas y RPC para las gráficas del dashboard. Mismo patrón de
-- enmascarado de costos que vista_inventario_actual (011): las vistas corren
-- como dueño (sin security_invoker) y el CASE WHEN usa get_user_rol() para
-- devolver null en costos a quien no tiene permiso — tanto en el panel como,
-- más adelante, en los correos que se arman desde estos mismos datos.

-- ===================== vista_movimientos_por_dia =====================
create or replace view vista_movimientos_por_dia as
select
  m.created_at::date as fecha,
  m.tipo_movimiento,
  count(*) as cantidad_movimientos,
  sum(abs(m.cantidad)) as unidades,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then sum(abs(m.cantidad) * coalesce(m.valor_unitario, 0))
       else null
  end as valor
from movimientos_inventario m
where m.estado = 'aplicado'
group by m.created_at::date, m.tipo_movimiento;

-- ===================== vista_stock_por_bodega =====================
create or replace view vista_stock_por_bodega as
select
  bodega,
  count(distinct codigo_producto) as productos_distintos,
  sum(saldo) as unidades,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then sum(valor_total) else null
  end as valor_total
from vista_inventario_por_bodega
group by bodega;

-- ===================== vista_stock_por_categoria =====================
create or replace view vista_stock_por_categoria as
select
  coalesce(categoria, 'Sin categoría') as categoria,
  count(distinct codigo_producto) as productos_distintos,
  sum(saldo) as unidades,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then sum(valor_total) else null
  end as valor_total
from vista_inventario_actual
group by categoria;

-- ===================== vista_top_productos =====================
-- Top 20 por valor (o por unidades para quien no ve costos).
create or replace view vista_top_productos as
select
  codigo_producto, nombre_producto, categoria, saldo,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then valor_total else null end as valor_total,
  row_number() over (
    order by case when get_user_rol() in ('supervisor','compras','auditoria')
                   then valor_total else saldo end desc nulls last
  ) as posicion
from vista_inventario_actual
order by posicion
limit 20;

-- ===================== vista_vehiculos_por_etapa =====================
create or replace view vista_vehiculos_por_etapa as
select proceso_estado as etapa, count(*) as vehiculos
from (
  select distinct on (chasis) chasis, proceso_estado
  from vehiculo_procesos
  order by chasis, creado_en desc
) ultimos
group by proceso_estado;

-- ===================== vista_ajustes_por_estado =====================
create or replace view vista_ajustes_por_estado as
select estado, count(*) as cantidad
from ajustes_pendientes
group by estado;

-- ===================== vista_oc_por_estado =====================
create or replace view vista_oc_por_estado as
select
  estado,
  siigo_estado,
  count(*) as cantidad
from ordenes_compra
group by estado, siigo_estado;

-- ===================== vista_tendencia_valorizacion =====================
-- Últimos 90 días de kpi_diario (ya cerrado por el cron de B5).
create or replace view vista_tendencia_valorizacion as
select
  fecha,
  unidades_entrada, unidades_salida,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then valor_entrada else null end as valor_entrada,
  case when get_user_rol() in ('supervisor','compras','auditoria')
       then valor_salida else null end as valor_salida
from kpi_diario
where fecha >= current_date - interval '90 days'
order by fecha;

grant select on
  vista_movimientos_por_dia,
  vista_stock_por_bodega,
  vista_stock_por_categoria,
  vista_top_productos,
  vista_vehiculos_por_etapa,
  vista_ajustes_por_estado,
  vista_oc_por_estado,
  vista_tendencia_valorizacion
to authenticated;

-- ===================== rpc_kpis_dashboard =====================
-- Resumen de una sola llamada para los stat-tiles de arriba del dashboard.
-- Combina el último cierre kpi_diario (histórico) con conteos en vivo de lo
-- que todavía no cerró el día (alertas abiertas, ajustes pendientes, etc.)
-- y las notificaciones no leídas del usuario que llama.
create or replace function rpc_kpis_dashboard()
returns jsonb
language plpgsql
security invoker
stable
as $$
declare
  v_rol text := get_user_rol();
  v_puede_ver_costos boolean := v_rol in ('supervisor','compras','auditoria');
  v_result jsonb;
begin
  if v_rol is null then
    raise exception 'No autorizado';
  end if;

  select jsonb_build_object(
    'fecha', current_date,
    'rol', v_rol,
    'stock_unidades', (select coalesce(sum(saldo), 0) from vista_inventario_actual),
    'stock_valor', case when v_puede_ver_costos
                     then (select coalesce(sum(valor_total), 0) from vista_inventario_actual)
                     else null end,
    'alertas_stock_bajo_abiertas', (select count(*) from alertas_stock_bajo where abierta = true),
    'ajustes_pendientes', (select count(*) from ajustes_pendientes where estado = 'pendiente'),
    'oc_abiertas', (select count(*) from ordenes_compra where estado = 'en_curso'),
    'oc_vencidas', (select count(*) from ordenes_compra
                      where estado not in ('listo','cancelada')
                        and fecha_vencimiento is not null and fecha_vencimiento < current_date),
    'oc_pendientes_siigo', (select count(*) from ordenes_compra where siigo_estado in ('pendiente','enviando','error')),
    'notificaciones_no_leidas', (select count(*) from notificaciones
                                    where usuario_destino = auth.uid() and leida = false),
    'sync_pendientes_abiertos', (select count(*) from sync_pendientes where estado in ('pendiente','reintentando'))
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function rpc_kpis_dashboard() to authenticated;
