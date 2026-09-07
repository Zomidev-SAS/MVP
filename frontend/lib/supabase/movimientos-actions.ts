'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewMovimientosData } from '@/lib/dev/preview-movimientos-data'
import { MOVIMIENTOS_PAGE_SIZE } from '@/lib/supabase/movimientos-page-size'
import type {
  MovimientoDetalle,
  MovimientosFiltros,
  MovimientosPagina,
} from '@/lib/types/movimientos'

export async function fetchMovimientos(
  filtros: MovimientosFiltros,
  pagina: number
): Promise<MovimientosPagina> {
  if (isDevBypassActive()) {
    return fetchMovimientosPreview(filtros, pagina)
  }

  const supabase = await createClient()

  const from = (pagina - 1) * MOVIMIENTOS_PAGE_SIZE
  const to = from + MOVIMIENTOS_PAGE_SIZE - 1

  let query = supabase
    .from('vista_movimientos_recientes')
    .select(
      'id, vin, tipo_movimiento, cantidad, valor_unitario, marca, categoria, ubicacion, formulario_id, motivo, actor_nombre, aprobado_por, estado, created_at',
      { count: 'exact' }
    )

  if (filtros.vin) {
    query = query.eq('vin', filtros.vin)
  }
  if (filtros.tipo !== 'todos') {
    query = query.eq('tipo_movimiento', filtros.tipo)
  }
  if (filtros.desde) {
    query = query.gte('created_at', filtros.desde)
  }
  if (filtros.hasta) {
    query = query.lte('created_at', filtros.hasta)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('Failed to load vista_movimientos_recientes:', error)
    return { filas: [], total: 0 }
  }

  return { filas: (data ?? []) as MovimientoDetalle[], total: count ?? 0 }
}

function fetchMovimientosPreview(
  filtros: MovimientosFiltros,
  pagina: number
): MovimientosPagina {
  const todas = getDevPreviewMovimientosData()

  const filtradas = todas.filter((item) => {
    if (filtros.vin && item.vin !== filtros.vin) return false
    if (filtros.tipo !== 'todos' && item.tipo_movimiento !== filtros.tipo) return false
    if (filtros.desde && item.created_at < filtros.desde) return false
    if (filtros.hasta && item.created_at > filtros.hasta) return false
    return true
  })

  const from = (pagina - 1) * MOVIMIENTOS_PAGE_SIZE
  const to = from + MOVIMIENTOS_PAGE_SIZE

  return { filas: filtradas.slice(from, to), total: filtradas.length }
}
