import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewInventarioData } from '@/lib/dev/preview-inventario-data'
import type { InventarioFiltros, InventarioItem, InventarioPagina } from '@/lib/types/inventario'

export const INVENTARIO_PAGE_SIZE = 20

export async function fetchInventario(
  filtros: InventarioFiltros,
  pagina: number
): Promise<InventarioPagina> {
  'use server'

  if (isDevBypassActive()) {
    return fetchInventarioPreview(filtros, pagina)
  }

  const supabase = await createClient()

  const from = (pagina - 1) * INVENTARIO_PAGE_SIZE
  const to = from + INVENTARIO_PAGE_SIZE - 1

  let query = supabase
    .from('vista_inventario_actual')
    .select(
      'vin, marca, categoria, ubicacion, saldo, valor_unitario, valor_total, ultimo_movimiento',
      { count: 'exact' }
    )

  if (filtros.vin) {
    query = query.eq('vin', filtros.vin)
  }
  if (filtros.marca) {
    query = query.ilike('marca', `%${filtros.marca}%`)
  }
  if (filtros.categoria) {
    query = query.ilike('categoria', `%${filtros.categoria}%`)
  }
  if (filtros.estado === 'activo') {
    query = query.gt('saldo', 0)
  } else if (filtros.estado === 'agotado') {
    query = query.lte('saldo', 0)
  }
  if (filtros.desde) {
    query = query.gte('ultimo_movimiento', filtros.desde)
  }
  if (filtros.hasta) {
    query = query.lte('ultimo_movimiento', filtros.hasta)
  }

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
    if (filtros.vin && item.vin !== filtros.vin) return false
    if (filtros.marca && !(item.marca ?? '').toLowerCase().includes(filtros.marca.toLowerCase())) {
      return false
    }
    if (
      filtros.categoria &&
      !(item.categoria ?? '').toLowerCase().includes(filtros.categoria.toLowerCase())
    ) {
      return false
    }
    if (filtros.estado === 'activo' && item.saldo <= 0) return false
    if (filtros.estado === 'agotado' && item.saldo > 0) return false
    if (filtros.desde && item.ultimo_movimiento < filtros.desde) return false
    if (filtros.hasta && item.ultimo_movimiento > filtros.hasta) return false
    return true
  })

  const from = (pagina - 1) * INVENTARIO_PAGE_SIZE
  const to = from + INVENTARIO_PAGE_SIZE

  return { filas: filtradas.slice(from, to), total: filtradas.length }
}
