import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewDashboardData } from '@/lib/dev/preview-dashboard-data'
import type { DashboardData, EntradaSalidaDia, MovimientoReciente } from '@/lib/types/dashboard'

const STOCK_BAJO_THRESHOLD = 2

export async function getDashboardData(): Promise<DashboardData> {
  if (isDevBypassActive()) {
    return getDevPreviewDashboardData()
  }

  const supabase = await createClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const [inventarioResult, movimientosHoyResult, entradasSalidasResult, ultimosResult] =
    await Promise.all([
      supabase.from('vista_inventario_actual').select('saldo, valor_total'),
      supabase
        .from('movimientos_inventario')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'aplicado')
        .gte('created_at', todayStart.toISOString()),
      supabase
        .from('movimientos_inventario')
        .select('tipo_movimiento, created_at')
        .eq('estado', 'aplicado')
        .in('tipo_movimiento', ['entrada', 'salida_vin'])
        .gte('created_at', sevenDaysAgo.toISOString()),
      supabase
        .from('vista_movimientos_recientes')
        .select('id, vin, tipo_movimiento, cantidad, actor_nombre, created_at')
        .limit(10),
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
  const totalUnidades = inventarioRows.reduce((sum, row) => sum + (row.saldo ?? 0), 0)
  const valorTotal = inventarioRows.reduce((sum, row) => sum + (row.valor_total ?? 0), 0)
  const stockBajo = inventarioRows.filter(
    (row) => (row.saldo ?? 0) <= STOCK_BAJO_THRESHOLD
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
  rows: { tipo_movimiento: string; created_at: string }[],
  startDate: Date
): EntradaSalidaDia[] {
  const days: EntradaSalidaDia[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    days.push({ fecha: d.toISOString().slice(0, 10), entradas: 0, salidas: 0 })
  }

  for (const row of rows) {
    const fecha = row.created_at.slice(0, 10)
    const day = days.find((d) => d.fecha === fecha)
    if (!day) continue
    if (row.tipo_movimiento === 'entrada') day.entradas += 1
    if (row.tipo_movimiento === 'salida_vin') day.salidas += 1
  }

  return days
}
