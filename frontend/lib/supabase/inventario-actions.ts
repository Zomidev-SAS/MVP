'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewInventarioData } from '@/lib/dev/preview-inventario-data'
import { INVENTARIO_PAGE_SIZE } from '@/lib/supabase/inventario-page-size'
import type { InventarioFiltros, InventarioItem, InventarioPagina } from '@/lib/types/inventario'

const STOCK_BAJO_THRESHOLD = 2

export async function fetchInventario(
  filtros: InventarioFiltros,
  pagina: number
): Promise<InventarioPagina> {
  if (isDevBypassActive()) {
    return fetchInventarioPreview(filtros, pagina)
  }

  const supabase = await createClient()

  let query = supabase
    .from('vista_inventario_actual')
    .select(
      'codigo_producto, nombre_producto, unidad_medida, categoria, saldo, valor_unitario, valor_total, ultimo_movimiento',
      { count: 'exact' }
    )

  if (filtros.categoria) query = query.ilike('categoria', `%${filtros.categoria}%`)
  if (filtros.estado === 'activo') query = query.gt('saldo', 0)
  else if (filtros.estado === 'agotado') query = query.lte('saldo', 0)
  if (filtros.desde) query = query.gte('ultimo_movimiento', filtros.desde)
  if (filtros.hasta) query = query.lte('ultimo_movimiento', filtros.hasta)
  if (filtros.busqueda) {
    query = query.or(
      `codigo_producto.ilike.%${filtros.busqueda}%,nombre_producto.ilike.%${filtros.busqueda}%`
    )
  }

  const from = (pagina - 1) * INVENTARIO_PAGE_SIZE
  const to = from + INVENTARIO_PAGE_SIZE - 1

  const { data, error, count } = await query.range(from, to)

  if (error) {
    console.error('Failed to load vista_inventario_actual:', error)
    return { filas: [], total: 0 }
  }

  return { filas: (data ?? []) as InventarioItem[], total: count ?? 0 }
}

function fetchInventarioPreview(filtros: InventarioFiltros, pagina: number): InventarioPagina {
  const todas = getDevPreviewInventarioData()
  const filtradas = todas.filter((item) => {
    if (filtros.categoria && item.categoria !== filtros.categoria) return false
    if (filtros.estado === 'activo' && item.saldo <= 0) return false
    if (filtros.estado === 'agotado' && item.saldo > 0) return false
    if (filtros.busqueda) {
      const b = filtros.busqueda.toLowerCase()
      const matches =
        item.codigo_producto.toLowerCase().includes(b) ||
        (item.nombre_producto ?? '').toLowerCase().includes(b)
      if (!matches) return false
    }
    return true
  })

  const from = (pagina - 1) * INVENTARIO_PAGE_SIZE
  const to = from + INVENTARIO_PAGE_SIZE

  return { filas: filtradas.slice(from, to), total: filtradas.length }
}

/**
 * Conteo de productos con saldo bajo (0 < saldo <= umbral). Usado por el
 * layout del panel para el indicador de notificaciones (Header/Sidebar).
 * TODO(Task 8 del plan): conectar el umbral a config_app.umbral_stock_bajo
 * en vez de la constante local.
 */
export async function fetchStockBajoCount(): Promise<number> {
  if (isDevBypassActive()) {
    return 3
  }

  const supabase = await createClient()

  const { count, error } = await supabase
    .from('vista_inventario_actual')
    .select('codigo_producto', { count: 'exact', head: true })
    .gt('saldo', 0)
    .lte('saldo', STOCK_BAJO_THRESHOLD)

  if (error) {
    console.error('Failed to count stock bajo:', error)
    return 0
  }

  return count ?? 0
}

/**
 * Productos con saldo bajo para el widget del Dashboard (rol compras).
 */
export async function fetchProductosBajoStock(
  limite: number
): Promise<{ codigo_producto: string; nombre_producto: string | null; saldo: number }[]> {
  if (isDevBypassActive()) {
    return Array.from({ length: Math.min(limite, 5) }, (_, i) => ({
      codigo_producto: `${10024 + i}`,
      nombre_producto: `Producto de ejemplo ${i + 1}`,
      saldo: i + 1,
    }))
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vista_inventario_actual')
    .select('codigo_producto, nombre_producto, saldo')
    .gt('saldo', 0)
    .lte('saldo', STOCK_BAJO_THRESHOLD)
    .order('saldo', { ascending: true })
    .limit(limite)

  if (error) {
    console.error('Failed to load productos bajo stock:', error)
    return []
  }

  return (data ?? []).map((row) => ({
    codigo_producto: row.codigo_producto,
    nombre_producto: row.nombre_producto,
    saldo: row.saldo,
  }))
}
