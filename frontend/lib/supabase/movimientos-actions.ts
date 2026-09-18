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
      'id, codigo_producto, producto_nombre, tipo_movimiento, cantidad, valor_unitario, bodega, formulario_id, motivo, actor_id, actor_nombre, aprobado_por, estado, created_at',
      { count: 'exact' }
    )

  if (filtros.codigoProducto) {
    query = query.eq('codigo_producto', filtros.codigoProducto)
  }
  if (filtros.bodega) {
    query = query.eq('bodega', filtros.bodega)
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
    if (filtros.codigoProducto && item.codigo_producto !== filtros.codigoProducto) return false
    if (filtros.bodega && item.bodega !== filtros.bodega) return false
    if (filtros.tipo !== 'todos' && item.tipo_movimiento !== filtros.tipo) return false
    if (filtros.desde && item.created_at < filtros.desde) return false
    if (filtros.hasta && item.created_at > filtros.hasta) return false
    return true
  })

  const from = (pagina - 1) * MOVIMIENTOS_PAGE_SIZE
  const to = from + MOVIMIENTOS_PAGE_SIZE

  return { filas: filtradas.slice(from, to), total: filtradas.length }
}
