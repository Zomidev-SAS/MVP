'use server'

import { filtrarInventarioLocal } from '@/lib/inventario/filtros-local'
import { parsearInventarioExcelBuffer } from '@/lib/inventario/parse-excel'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { INVENTARIO_PAGE_SIZE } from '@/lib/supabase/inventario-page-size'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import type { InventarioFiltros, InventarioItem, InventarioPagina } from '@/lib/types/inventario'

const BATCH_SIZE = 400

export async function fetchInventarioSaldosNube(
  filtros: InventarioFiltros,
  pagina: number
): Promise<InventarioPagina | null> {
  const supabase = await createClient()

  const { count, error: countError } = await supabase
    .from('inventario_saldos')
    .select('codigo', { count: 'exact', head: true })

  if (countError) {
    if (esTablaInexistente(countError)) return null
    console.error('Failed to count inventario_saldos:', countError)
    return { filas: [], total: 0, fuente: 'excel', origen: 'nube' }
  }

  if (!count || count === 0) return null

  const { data: meta } = await supabase
    .from('inventario_saldos_meta')
    .select('fecha_corte, imported_at, total_productos')
    .eq('id', 1)
    .maybeSingle()

  const necesitaFiltroMemoria =
    filtros.busqueda.trim().length > 0 ||
    (filtros.marca.trim().length > 0 && filtros.vin.trim().length === 0)

  if (necesitaFiltroMemoria) {
    const { data, error } = await supabase.from('inventario_saldos').select('*')
    if (error) {
      console.error('Failed to load inventario_saldos:', error)
      return { filas: [], total: 0, fuente: 'excel', origen: 'nube' }
    }

    const filas = (data ?? []).map(mapearFilaNube)
    const filtradas = filtrarInventarioLocal(filas, filtros)
    const from = (pagina - 1) * INVENTARIO_PAGE_SIZE
    const to = from + INVENTARIO_PAGE_SIZE

    return {
      filas: filtradas.slice(from, to),
      total: filtradas.length,
      fuente: 'excel',
      origen: 'nube',
      fechaCorte: meta?.fecha_corte ?? null,
    }
  }

  let query = supabase.from('inventario_saldos').select('*', { count: 'exact' })

  if (filtros.vin.trim()) {
    query = query.eq('codigo', filtros.vin.trim())
  }
  if (filtros.categoria.trim()) {
    query = query.ilike('categoria', `%${filtros.categoria.trim()}%`)
  }
  if (filtros.ubicacion.trim()) {
    query = query.ilike('ubicacion', `%${filtros.ubicacion.trim()}%`)
  }
  if (filtros.estado === 'activo') {
    query = query.gt('saldo', 0)
  } else if (filtros.estado === 'agotado') {
    query = query.lte('saldo', 0)
  }

  const from = (pagina - 1) * INVENTARIO_PAGE_SIZE
  const to = from + INVENTARIO_PAGE_SIZE - 1

  const { data, error, count: totalFiltrado } = await query
    .order('codigo', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('Failed to load inventario_saldos:', error)
    return { filas: [], total: 0, fuente: 'excel', origen: 'nube' }
  }

  return {
    filas: (data ?? []).map(mapearFilaNube),
    total: totalFiltrado ?? 0,
    fuente: 'excel',
    origen: 'nube',
    fechaCorte: meta?.fecha_corte ?? null,
  }
}

export async function publicarInventarioSaldos(
  formData: FormData
): Promise<{ ok: true; total: number } | { ok: false; error: string }> {
  const user = await getSessionUser()
  if (!user) {
    return { ok: false, error: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const archivo = formData.get('archivo')
  if (!(archivo instanceof File)) {
    return { ok: false, error: 'Selecciona un archivo Excel (.xlsx).' }
  }

  if (!archivo.name.toLowerCase().endsWith('.xlsx')) {
    return { ok: false, error: 'El archivo debe ser .xlsx' }
  }

  const buffer = Buffer.from(await archivo.arrayBuffer())
  const parseado = parsearInventarioExcelBuffer(buffer, archivo.name)

  if (!parseado || parseado.filas.length === 0) {
    return { ok: false, error: 'No se encontraron productos en el Excel.' }
  }

  const supabase = await createClient()

  const { error: deleteError } = await supabase.from('inventario_saldos').delete().neq('codigo', '')
  if (deleteError) {
    console.error('Failed to clear inventario_saldos:', deleteError)
    return {
      ok: false,
      error: esTablaInexistente(deleteError)
        ? 'Falta crear la tabla inventario_saldos en Supabase. Ejecuta supabase/sql/inventario-saldos.sql'
        : deleteError.message,
    }
  }

  const filasDb = parseado.filas.map((fila) => ({
    codigo: fila.codigo,
    nombre: fila.nombre,
    unidad: fila.unidad,
    categoria: fila.categoria,
    ubicacion: fila.ubicacion,
    saldo: fila.saldo,
    valor_unitario: fila.valor_unitario,
    valor_total: fila.valor_total,
    updated_at: new Date().toISOString(),
  }))

  for (let i = 0; i < filasDb.length; i += BATCH_SIZE) {
    const lote = filasDb.slice(i, i + BATCH_SIZE)
    const { error: insertError } = await supabase.from('inventario_saldos').insert(lote)
    if (insertError) {
      console.error('Failed to insert inventario_saldos batch:', insertError)
      return { ok: false, error: insertError.message }
    }
  }

  const { error: metaError } = await supabase.from('inventario_saldos_meta').upsert({
    id: 1,
    fecha_corte: parseado.fechaCorte,
    total_productos: parseado.filas.length,
    imported_at: new Date().toISOString(),
    imported_by: user.id,
  })

  if (metaError) {
    console.error('Failed to update inventario_saldos_meta:', metaError)
    return { ok: false, error: metaError.message }
  }

  return { ok: true, total: parseado.filas.length }
}

function mapearFilaNube(row: Record<string, unknown>): InventarioItem {
  return {
    codigo: String(row.codigo),
    nombre: typeof row.nombre === 'string' ? row.nombre : null,
    vin: null,
    marca: null,
    categoria: typeof row.categoria === 'string' ? row.categoria : null,
    ubicacion: typeof row.ubicacion === 'string' ? row.ubicacion : null,
    unidad: typeof row.unidad === 'string' ? row.unidad : null,
    saldo: Number(row.saldo) || 0,
    valor_unitario: row.valor_unitario != null ? Number(row.valor_unitario) : null,
    valor_total: Number(row.valor_total) || 0,
    ultimo_movimiento:
      typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

function esTablaInexistente(error: { code?: string; message?: string }): boolean {
  return error.code === '42P01' || (error.message ?? '').includes('does not exist')
}

const STOCK_BAJO_THRESHOLD = 2

export async function fetchStockBajoCount(): Promise<number> {
  if (isDevBypassActive()) {
    return 3
  }

  const supabase = await createClient()

  const { count, error } = await supabase
    .from('inventario_saldos')
    .select('codigo', { count: 'exact', head: true })
    .gt('saldo', 0)
    .lte('saldo', STOCK_BAJO_THRESHOLD)

  if (error) {
    console.error('Failed to count stock bajo:', error)
    return 0
  }

  return count ?? 0
}

export async function fetchProductosBajoStock(
  limite: number
): Promise<{ codigo: string; nombre: string | null; saldo: number }[]> {
  if (isDevBypassActive()) {
    return Array.from({ length: Math.min(limite, 5) }, (_, i) => ({
      codigo: `PRD-${1000 + i}`,
      nombre: `Producto de ejemplo ${i + 1}`,
      saldo: i + 1,
    }))
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('inventario_saldos')
    .select('codigo, nombre, saldo')
    .gt('saldo', 0)
    .lte('saldo', STOCK_BAJO_THRESHOLD)
    .order('saldo', { ascending: true })
    .limit(limite)

  if (error) {
    console.error('Failed to load productos bajo stock:', error)
    return []
  }

  return data ?? []
}
