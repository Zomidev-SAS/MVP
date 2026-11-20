'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { PREVIEW_DASHBOARD_GRAFICAS } from '@/lib/dev/preview-dashboard-graficas-data'
import { CAN_VIEW_COSTS } from '@/lib/permissions/roles'
import type { Role } from '@/lib/types/database'
import type {
  AjusteOCPorEstadoPunto,
  DashboardFiltros,
  DashboardGraficasPayload,
  IndicadorKpi,
  RangoFecha,
} from '@/lib/types/dashboard-graficas'

// Backend real (migraciones 031-046 + docs/CONTRATO_DATOS_SECCION2.md) no entrega
// un solo RPC `dashboard_graficas`: entrega `rpc_kpis_dashboard()` + 8 vistas
// separadas (B6). Esta función compone esas 9 fuentes en el payload que ya
// consume DashboardGraficasSection, sin tocar los componentes de gráficas.

function resolverRangoFechas(filtros: DashboardFiltros): { desde: string | null; hasta: string | null } {
  if (filtros.rango === 'personalizado') {
    return { desde: filtros.desde ?? null, hasta: filtros.hasta ?? null }
  }
  const dias: Record<RangoFecha, number> = { hoy: 0, '7d': 6, '30d': 29, '90d': 89, personalizado: 0 }
  const hasta = new Date()
  const desde = new Date(hasta.getTime() - dias[filtros.rango] * 24 * 60 * 60 * 1000)
  return { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) }
}

export async function fetchDashboardGraficas(
  rol: Role,
  filtros: DashboardFiltros
): Promise<DashboardGraficasPayload> {
  const puedeVerCostos = CAN_VIEW_COSTS.includes(rol)

  if (isDevBypassActive()) {
    return {
      ...PREVIEW_DASHBOARD_GRAFICAS,
      valorizacion: puedeVerCostos ? PREVIEW_DASHBOARD_GRAFICAS.valorizacion : null,
      kpis: puedeVerCostos
        ? PREVIEW_DASHBOARD_GRAFICAS.kpis
        : PREVIEW_DASHBOARD_GRAFICAS.kpis.filter((k) => k.unidad !== 'cop'),
    }
  }

  // Seguridad: este archivo es 'use server', así que cualquier cliente puede invocar
  // esta acción con un `rol` falsificado. Por eso el permiso de costos se decide con el
  // rol de la sesión real (resuelto en el servidor), nunca con el parámetro `rol`.
  const sesion = await getCurrentProfile()
  if (sesion.status !== 'authenticated') throw new Error('Sesión no válida')
  const puedeVerCostosReal = CAN_VIEW_COSTS.includes(sesion.profile.rol)

  const supabase = await createClient()
  const { desde, hasta } = resolverRangoFechas(filtros)

  let movimientosQuery = supabase
    .from('vista_movimientos_por_dia')
    .select('fecha, tipo_movimiento, unidades')
  if (desde) movimientosQuery = movimientosQuery.gte('fecha', desde)
  if (hasta) movimientosQuery = movimientosQuery.lte('fecha', hasta)

  let stockBodegaQuery = supabase.from('vista_stock_por_bodega').select('bodega, unidades')
  if (filtros.bodegaId) stockBodegaQuery = stockBodegaQuery.eq('bodega', filtros.bodegaId)

  let stockCategoriaQuery = supabase.from('vista_stock_por_categoria').select('categoria, unidades')
  if (filtros.categoriaId) stockCategoriaQuery = stockCategoriaQuery.eq('categoria', filtros.categoriaId)

  let topProductosQuery = supabase
    .from('vista_top_productos')
    .select('nombre_producto, categoria, saldo, valor_total')
    .order('posicion', { ascending: true })
  if (filtros.categoriaId) topProductosQuery = topProductosQuery.eq('categoria', filtros.categoriaId)

  let valorizacionQuery = supabase
    .from('vista_tendencia_valorizacion')
    .select('fecha, valor_entrada, valor_salida')
  if (desde) valorizacionQuery = valorizacionQuery.gte('fecha', desde)
  if (hasta) valorizacionQuery = valorizacionQuery.lte('fecha', hasta)

  const [
    kpisResult,
    movimientosResult,
    stockBodegaResult,
    stockCategoriaResult,
    topProductosResult,
    vehiculosResult,
    ajustesEstadoResult,
    ocEstadoResult,
    valorizacionResult,
  ] = await Promise.all([
    supabase.rpc('rpc_kpis_dashboard'),
    movimientosQuery,
    stockBodegaQuery,
    stockCategoriaQuery,
    topProductosQuery,
    supabase.from('vista_vehiculos_por_etapa').select('etapa, vehiculos'),
    supabase.from('vista_ajustes_por_estado').select('estado, cantidad'),
    supabase.from('vista_oc_por_estado').select('estado, cantidad'),
    valorizacionQuery,
  ])

  if (kpisResult.error) {
    throw new Error(`No se pudo cargar rpc_kpis_dashboard: ${kpisResult.error.message}`)
  }

  const kpisRaw = kpisResult.data as Record<string, number | string | null>

  const kpis: IndicadorKpi[] = [
    { id: 'stock_unidades', etiqueta: 'Stock total', unidad: 'unidades' as const, valor: kpisRaw.stock_unidades },
    { id: 'stock_valor', etiqueta: 'Valor de inventario', unidad: 'cop' as const, valor: kpisRaw.stock_valor },
    {
      id: 'alertas_stock_bajo',
      etiqueta: 'Alertas de stock bajo',
      unidad: 'unidades' as const,
      valor: kpisRaw.alertas_stock_bajo_abiertas,
    },
    { id: 'ajustes_pendientes', etiqueta: 'Ajustes pendientes', unidad: 'unidades' as const, valor: kpisRaw.ajustes_pendientes },
    { id: 'oc_abiertas', etiqueta: 'OC abiertas', unidad: 'unidades' as const, valor: kpisRaw.oc_abiertas },
    { id: 'oc_vencidas', etiqueta: 'OC vencidas', unidad: 'unidades' as const, valor: kpisRaw.oc_vencidas },
    { id: 'oc_pendientes_siigo', etiqueta: 'OC pendientes de Siigo', unidad: 'unidades' as const, valor: kpisRaw.oc_pendientes_siigo },
  ]
    .filter((k) => k.valor !== null && k.valor !== undefined)
    .map((k) => ({ ...k, valor: Number(k.valor), variacionPct: null }))

  const entradasPorFecha = new Map<string, { entradas: number; salidas: number }>()
  for (const fila of movimientosResult.data ?? []) {
    const actual = entradasPorFecha.get(fila.fecha) ?? { entradas: 0, salidas: 0 }
    if (fila.tipo_movimiento === 'entrada') actual.entradas += fila.unidades ?? 0
    if (fila.tipo_movimiento === 'salida_vin') actual.salidas += fila.unidades ?? 0
    entradasPorFecha.set(fila.fecha, actual)
  }
  const entradasSalidas = Array.from(entradasPorFecha.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, v]) => ({ fecha, ...v }))

  const stockPorBodega = (stockBodegaResult.data ?? []).map((f) => ({ bodega: f.bodega, cantidad: f.unidades ?? 0 }))
  const stockPorCategoria = (stockCategoriaResult.data ?? []).map((f) => ({
    categoria: f.categoria,
    cantidad: f.unidades ?? 0,
  }))
  const topProductos = (topProductosResult.data ?? []).map((f) => ({
    producto: f.nombre_producto,
    cantidad: f.valor_total ?? f.saldo ?? 0,
  }))
  // NOTA: `tiempoPromedioDias` no existe en vista_vehiculos_por_etapa (B6) —
  // el backend no calcula tiempo por etapa. Queda en 0 hasta que se agregue.
  const vehiculosPorEtapa = (vehiculosResult.data ?? []).map((f) => ({
    etapa: f.etapa,
    cantidad: f.vehiculos ?? 0,
    tiempoPromedioDias: 0,
  }))

  const ajustesOCPorEstado: AjusteOCPorEstadoPunto[] = [
    ...(ajustesEstadoResult.data ?? []).map((f) => ({ tipo: 'ajuste' as const, estado: f.estado, cantidad: f.cantidad })),
    ...Array.from(
      (ocEstadoResult.data ?? []).reduce((acc, f) => {
        acc.set(f.estado, (acc.get(f.estado) ?? 0) + f.cantidad)
        return acc
      }, new Map<string, number>())
    ).map(([estado, cantidad]) => ({ tipo: 'orden_compra' as const, estado, cantidad })),
  ]

  const valorizacion = (valorizacionResult.data ?? []).map((f) => ({
    fecha: f.fecha,
    valorCop: (f.valor_entrada ?? 0) - (f.valor_salida ?? 0),
  }))

  return {
    kpis,
    entradasSalidas,
    stockPorBodega,
    stockPorCategoria,
    topProductos,
    vehiculosPorEtapa,
    ajustesOCPorEstado,
    valorizacion: puedeVerCostosReal ? valorizacion : null,
  }
}
