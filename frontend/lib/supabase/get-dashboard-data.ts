import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewDashboardData } from '@/lib/dev/preview-dashboard-data'
import { getUmbralesStock } from '@/lib/supabase/get-stock-threshold'
import { umbralDeCategoria } from '@/lib/stock/umbral'
import type { DashboardData, EntradaSalidaDia, MovimientoReciente } from '@/lib/types/dashboard'

// Colombia does not observe DST — a fixed UTC-5 offset is always correct,
// so day boundaries below are computed deterministically regardless of the
// server process's ambient timezone (most deploy environments default to
// UTC, not America/Bogota).
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function bogotaDateKey(isoString: string): string {
  const bogotaMs = new Date(isoString).getTime() + BOGOTA_OFFSET_MS
  return new Date(bogotaMs).toISOString().slice(0, 10)
}

// The UTC instant corresponding to today's midnight in Bogota time.
function getBogotaTodayStart(): Date {
  const bogotaMs = Date.now() + BOGOTA_OFFSET_MS
  const bogotaDateStr = new Date(bogotaMs).toISOString().slice(0, 10)
  return new Date(`${bogotaDateStr}T00:00:00-05:00`)
}

export interface DashboardDataFiltros {
  bodegaId?: string | null
  categoriaId?: string | null
}

export async function getDashboardData(
  limiteMovimientos: number = 10,
  filtros?: DashboardDataFiltros
): Promise<DashboardData> {
  if (isDevBypassActive()) {
    return getDevPreviewDashboardData(limiteMovimientos)
  }

  const supabase = await createClient()
  const bodegaId = filtros?.bodegaId ?? null
  const categoriaId = filtros?.categoriaId ?? null

  const todayStart = getBogotaTodayStart()
  const sevenDaysAgo = new Date(todayStart.getTime() - 6 * DAY_MS)

  // Sin filtro de bodega, el stock agregado por producto (todas las bodegas)
  // sale de vista_inventario_actual. Con bodega seleccionada hace falta la
  // vista desglosada por bodega (020), que agrega por producto+bodega en vez
  // de solo por producto.
  let inventarioQuery = bodegaId
    ? supabase.from('vista_inventario_por_bodega').select('saldo, valor_total, categoria').eq('bodega', bodegaId)
    : supabase.from('vista_inventario_actual').select('saldo, valor_total, categoria')
  if (categoriaId) inventarioQuery = inventarioQuery.eq('categoria', categoriaId)

  let movimientosHoyQuery = supabase
    .from('movimientos_inventario')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'aplicado')
    .gte('created_at', todayStart.toISOString())
  if (bodegaId) movimientosHoyQuery = movimientosHoyQuery.eq('bodega', bodegaId)

  let entradasSalidasQuery = supabase
    .from('movimientos_inventario')
    .select('tipo_movimiento, created_at')
    .eq('estado', 'aplicado')
    .in('tipo_movimiento', ['entrada', 'salida_vin'])
    .gte('created_at', sevenDaysAgo.toISOString())
  if (bodegaId) entradasSalidasQuery = entradasSalidasQuery.eq('bodega', bodegaId)

  const [inventarioResult, movimientosHoyResult, entradasSalidasResult, ultimosResult] =
    await Promise.all([
      inventarioQuery,
      movimientosHoyQuery,
      entradasSalidasQuery,
      supabase
        .from('vista_movimientos_recientes')
        .select('id, codigo_producto, tipo_movimiento, cantidad, actor_nombre, created_at')
        .order('created_at', { ascending: false })
        .limit(limiteMovimientos),
    ])

  if (inventarioResult.error) {
    console.error('Failed to load vista_inventario_actual:', inventarioResult.error)
  }
  if (movimientosHoyResult.error) {
    console.error('Failed to count movimientos del día:', movimientosHoyResult.error)
  }
  if (entradasSalidasResult.error) {
    console.error('Failed to load entradas vs salidas:', entradasSalidasResult.error)
  }
  if (ultimosResult.error) {
    console.error('Failed to load vista_movimientos_recientes:', ultimosResult.error)
  }

  const inventarioRows = inventarioResult.data ?? []
  const umbrales = await getUmbralesStock()
  const totalUnidades = inventarioRows.reduce((sum, row) => sum + (row.saldo ?? 0), 0)
  const valorTotal = inventarioRows.reduce((sum, row) => sum + (row.valor_total ?? 0), 0)
  const stockBajo = inventarioRows.filter(
    (row) =>
      (row.saldo ?? 0) > 0 &&
      (row.saldo ?? 0) <= umbralDeCategoria(umbrales, (row.categoria as string | null) ?? null)
  ).length

  const movimientosHoy = movimientosHoyResult.count ?? 0

  const entradasVsSalidas = buildEntradasVsSalidasSeries(
    entradasSalidasResult.data ?? [],
    sevenDaysAgo
  )

  const ultimosMovimientos = (ultimosResult.data ?? []) as MovimientoReciente[]

  return {
    totalUnidades,
    valorTotal,
    movimientosHoy,
    stockBajo,
    entradasVsSalidas,
    ultimosMovimientos,
  }
}

function buildEntradasVsSalidasSeries(
  rows: (Pick<MovimientoReciente, 'tipo_movimiento'> & { created_at: string })[],
  startDate: Date
): EntradaSalidaDia[] {
  const days: EntradaSalidaDia[] = []
  for (let i = 0; i < 7; i++) {
    const instant = new Date(startDate.getTime() + i * DAY_MS)
    days.push({ fecha: bogotaDateKey(instant.toISOString()), entradas: 0, salidas: 0 })
  }

  for (const row of rows) {
    const fecha = bogotaDateKey(row.created_at)
    const day = days.find((d) => d.fecha === fecha)
    if (!day) continue
    if (row.tipo_movimiento === 'entrada') day.entradas += 1
    if (row.tipo_movimiento === 'salida_vin') day.salidas += 1
  }

  return days
}
