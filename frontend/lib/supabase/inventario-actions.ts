'use server'

import { filtrarInventarioLocal } from '@/lib/inventario/filtros-local'
import { obtenerInventarioLocal } from '@/lib/inventario/cache-local'
import { fetchInventarioSaldosNube } from '@/lib/supabase/inventario-saldos-actions'
import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewInventarioData } from '@/lib/dev/preview-inventario-data'
import { INVENTARIO_PAGE_SIZE } from '@/lib/supabase/inventario-page-size'
import type { InventarioFiltros, InventarioItem, InventarioPagina } from '@/lib/types/inventario'

export async function fetchInventario(
  filtros: InventarioFiltros,
  pagina: number
): Promise<InventarioPagina> {
  const nube = await fetchInventarioSaldosNube(filtros, pagina)
  if (nube) return nube

  const local = obtenerInventarioLocal()
  if (local) {
    return fetchInventarioExcelLocal(local.filas, local.fechaCorte, local.archivo, filtros, pagina)
  }

  if (isDevBypassActive()) {
    return fetchInventarioPreview(filtros, pagina)
  }

  return {
    filas: [],
    total: 0,
    fuente: 'excel',
    origen: 'nube',
    fechaCorte: null,
  }
}

function fetchInventarioExcelLocal(
  todas: InventarioItem[],
  fechaCorte: string | null,
  archivo: string,
  filtros: InventarioFiltros,
  pagina: number
): InventarioPagina {
  const filtradas = filtrarInventarioLocal(todas, filtros)
  const from = (pagina - 1) * INVENTARIO_PAGE_SIZE
  const to = from + INVENTARIO_PAGE_SIZE

  return {
    filas: filtradas.slice(from, to),
    total: filtradas.length,
    fuente: 'excel',
    origen: 'local',
    fechaCorte,
    archivoLocal: archivo,
  }
}

/** Inventario de vehículos (VIN) — vista legacy, no usada en /inventario por defecto */
export async function fetchInventarioVehiculos(
  filtros: InventarioFiltros,
  pagina: number
): Promise<InventarioPagina> {
  const supabase = await createClient()

  const from = (pagina - 1) * INVENTARIO_PAGE_SIZE
  const to = from + INVENTARIO_PAGE_SIZE - 1

  let query = supabase
    .from('vista_inventario_actual')
    .select(
      'vin, marca, categoria, ubicacion, saldo, valor_unitario, valor_total, ultimo_movimiento',
      { count: 'exact' }
    )

  if (filtros.vin) query = query.eq('vin', filtros.vin)
  if (filtros.marca) query = query.ilike('marca', `%${filtros.marca}%`)
  if (filtros.categoria) query = query.ilike('categoria', `%${filtros.categoria}%`)
  if (filtros.ubicacion) query = query.ilike('ubicacion', `%${filtros.ubicacion}%`)
  if (filtros.estado === 'activo') query = query.gt('saldo', 0)
  else if (filtros.estado === 'agotado') query = query.lte('saldo', 0)
  if (filtros.desde) query = query.gte('ultimo_movimiento', filtros.desde)
  if (filtros.hasta) query = query.lte('ultimo_movimiento', filtros.hasta)

  const { data, error, count } = await query.range(from, to)

  if (error) {
    console.error('Failed to load vista_inventario_actual:', error)
    return { filas: [], total: 0, fuente: 'supabase' }
  }

  const filas: InventarioItem[] = (data ?? []).map((row) => ({
    codigo: row.vin,
    nombre: null,
    vin: row.vin,
    marca: row.marca,
    categoria: row.categoria,
    ubicacion: row.ubicacion,
    unidad: null,
    saldo: row.saldo,
    valor_unitario: row.valor_unitario,
    valor_total: row.valor_total,
    ultimo_movimiento: row.ultimo_movimiento,
  }))

  const filtradas = filtros.busqueda.trim()
    ? filtrarInventarioLocal(filas, filtros)
    : filas

  return {
    filas: filtradas,
    total: filtros.busqueda.trim() ? filtradas.length : (count ?? 0),
    fuente: 'supabase',
  }
}

function fetchInventarioPreview(filtros: InventarioFiltros, pagina: number): InventarioPagina {
  const todas = getDevPreviewInventarioData()
  const filtradas = filtrarInventarioLocal(todas, filtros)

  const from = (pagina - 1) * INVENTARIO_PAGE_SIZE
  const to = from + INVENTARIO_PAGE_SIZE

  return {
    filas: filtradas.slice(from, to),
    total: filtradas.length,
    fuente: 'excel',
    origen: 'nube',
  }
}
