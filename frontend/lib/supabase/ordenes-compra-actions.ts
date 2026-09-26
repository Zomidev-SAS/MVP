'use server'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import {
  devPreviewDeleteOrden,
  devPreviewInsertOrden,
  devPreviewUpdateOrden,
  getDevPreviewOrdenById,
  getDevPreviewOrdenesCompra,
  getDevPreviewOrdenesPendientesCount,
} from '@/lib/dev/preview-ordenes-compra-data'
import {
  guardarOrdenCompraPedidoSchema,
  type GuardarOrdenCompraPedidoInput,
  type OrdenCompra,
  type OrdenCompraItem,
  type OrdenCompraResultado,
  type EstadoOrdenCompra,
} from '@/lib/types/orden-compra'

const SELECT_ORDEN =
  'id, titulo, fecha_pedido, fecha_vencimiento, estado, observaciones, observaciones_entrega, creado_por, descargada_siigo_at, finalizada_at, siigo_referencia, created_at, updated_at'

const SELECT_ITEM =
  'id, orden_id, codigo_producto, nombre_producto, cantidad, cantidad_recibida, descripcion, proveedor_nit, proveedor_nombre, proveedor_email, observaciones, orden_linea'

type OrdenRow = Omit<OrdenCompra, 'items' | 'codigo_producto' | 'nombre_producto' | 'cantidad' | 'descripcion' | 'proveedor_nit' | 'proveedor_nombre'>

function enriquecerOrden(orden: OrdenRow, items: OrdenCompraItem[]): OrdenCompra {
  const primero = items[0]
  return {
    ...orden,
    items,
    codigo_producto: primero?.codigo_producto ?? null,
    nombre_producto: primero?.nombre_producto ?? null,
    cantidad: primero?.cantidad ?? null,
    descripcion: primero?.descripcion ?? null,
    proveedor_nit: primero?.proveedor_nit ?? null,
    proveedor_nombre: primero?.proveedor_nombre ?? null,
  }
}

async function cargarItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ordenIds: number[]
): Promise<Map<number, OrdenCompraItem[]>> {
  if (ordenIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('orden_compra_items')
    .select(SELECT_ITEM)
    .in('orden_id', ordenIds)
    .order('orden_linea', { ascending: true })

  if (error) {
    console.error('Failed to load orden_compra_items:', error)
    return new Map()
  }

  const map = new Map<number, OrdenCompraItem[]>()
  for (const row of (data ?? []) as OrdenCompraItem[]) {
    const lista = map.get(row.orden_id) ?? []
    lista.push(row)
    map.set(row.orden_id, lista)
  }
  return map
}

export async function fetchOrdenesCompra(): Promise<OrdenCompra[]> {
  if (isDevBypassActive()) {
    return getDevPreviewOrdenesCompra()
  }

  const user = await getSessionUser()
  if (!user) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ordenes_compra')
    .select(SELECT_ORDEN)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load ordenes_compra:', error)
    return []
  }

  const ordenes = (data ?? []) as OrdenRow[]
  const itemsMap = await cargarItems(
    supabase,
    ordenes.map((o) => o.id)
  )

  return ordenes.map((o) => enriquecerOrden(o, itemsMap.get(o.id) ?? []))
}

export async function fetchOrdenCompraById(id: number): Promise<OrdenCompra | null> {
  if (isDevBypassActive()) {
    return getDevPreviewOrdenById(id)
  }

  const user = await getSessionUser()
  if (!user) return null

  const supabase = await createClient()
  const { data, error } = await supabase.from('ordenes_compra').select(SELECT_ORDEN).eq('id', id).single()

  if (error || !data) return null

  const itemsMap = await cargarItems(supabase, [id])
  return enriquecerOrden(data as OrdenRow, itemsMap.get(id) ?? [])
}

export async function fetchOrdenesCompraProducto(codigoProducto: string): Promise<OrdenCompra[]> {
  const todas = await fetchOrdenesCompra()
  return todas.filter((o) => o.items.some((i) => i.codigo_producto === codigoProducto))
}

export async function fetchOrdenesCompraPendientes(): Promise<OrdenCompra[]> {
  if (isDevBypassActive()) {
    return getDevPreviewOrdenesCompra().filter((o) => o.estado === 'en_curso')
  }

  const user = await getSessionUser()
  if (!user) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ordenes_compra')
    .select(SELECT_ORDEN)
    .eq('estado', 'en_curso')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Failed to load ordenes pendientes:', error)
    return []
  }

  const ordenes = (data ?? []) as OrdenRow[]
  const itemsMap = await cargarItems(
    supabase,
    ordenes.map((o) => o.id)
  )
  return ordenes.map((o) => enriquecerOrden(o, itemsMap.get(o.id) ?? []))
}

export async function fetchOrdenesCompraPendientesCount(): Promise<number> {
  if (isDevBypassActive()) {
    return getDevPreviewOrdenesPendientesCount()
  }

  const user = await getSessionUser()
  if (!user) return 0

  const supabase = await createClient()
  const { count, error } = await supabase
    .from('ordenes_compra')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'en_curso')

  if (error) {
    console.error('Failed to count ordenes pendientes:', error)
    return 0
  }

  return count ?? 0
}

function mapPedidoHeader(datos: GuardarOrdenCompraPedidoInput, userId: string) {
  return {
    titulo: datos.titulo.trim(),
    fecha_pedido: datos.fecha_pedido,
    fecha_vencimiento: datos.fecha_vencimiento?.trim() || null,
    observaciones: datos.observaciones.trim() || null,
    observaciones_entrega: datos.observaciones_entrega.trim() || null,
    creado_por: userId,
    updated_at: new Date().toISOString(),
  }
}

function mapItemsInsert(ordenId: number, datos: GuardarOrdenCompraPedidoInput) {
  return datos.items.map((item, idx) => ({
    orden_id: ordenId,
    codigo_producto: item.codigo_producto,
    nombre_producto: item.nombre_producto.trim() || null,
    cantidad: item.cantidad,
    cantidad_recibida: item.cantidad_recibida ?? null,
    descripcion: item.descripcion,
    proveedor_nit: item.proveedor_nit.trim() || null,
    proveedor_nombre: item.proveedor_nombre.trim() || null,
    proveedor_email: item.proveedor_email.trim() || null,
    observaciones: item.observaciones.trim() || null,
    orden_linea: idx + 1,
  }))
}

export async function crearOrdenCompraPedido(
  datos: GuardarOrdenCompraPedidoInput
): Promise<OrdenCompraResultado> {
  const parsed = guardarOrdenCompraPedidoSchema.safeParse(datos)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos. Revisa el formulario.' }
  }

  if (isDevBypassActive()) {
    await new Promise((r) => setTimeout(r, 400))
    const nueva = devPreviewInsertOrden({
      ...mapPedidoHeader(parsed.data, 'dev-preview-user'),
      estado: 'en_curso',
      descargada_siigo_at: null,
      finalizada_at: null,
      siigo_referencia: null,
      items: parsed.data.items.map((item, idx) => ({
        ...item,
        cantidad_recibida: item.cantidad_recibida ?? null,
        observaciones: item.observaciones.trim() || null,
        orden_linea: idx + 1,
      })),
    })
    return { ok: true, id: nueva.id }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sesión expirada.' }

  const supabase = await createClient()
  const header = mapPedidoHeader(parsed.data, user.id)
  const primero = parsed.data.items[0]

  const { data: inserted, error } = await supabase
    .from('ordenes_compra')
    .insert({
      ...header,
      estado: 'en_curso',
      codigo_producto: primero.codigo_producto,
      nombre_producto: primero.nombre_producto.trim() || null,
      cantidad: primero.cantidad,
      descripcion: primero.descripcion,
      proveedor_nit: primero.proveedor_nit.trim() || null,
      proveedor_nombre: primero.proveedor_nombre.trim() || null,
      proveedor_email: primero.proveedor_email.trim() || null,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    console.error('Failed to insert orden_compra:', error)
    return { ok: false, error: 'No se pudo crear la orden de compra.' }
  }

  const { error: itemsError } = await supabase
    .from('orden_compra_items')
    .insert(mapItemsInsert(inserted.id, parsed.data))

  if (itemsError) {
    console.error('Failed to insert orden_compra_items:', itemsError)
    await supabase.from('ordenes_compra').delete().eq('id', inserted.id)
    return { ok: false, error: 'No se pudieron guardar los ítems de la orden.' }
  }

  return { ok: true, id: inserted.id }
}

export async function actualizarOrdenCompraPedido(
  id: number,
  datos: GuardarOrdenCompraPedidoInput
): Promise<OrdenCompraResultado> {
  const parsed = guardarOrdenCompraPedidoSchema.safeParse(datos)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos. Revisa el formulario.' }
  }

  if (isDevBypassActive()) {
    await new Promise((r) => setTimeout(r, 400))
    const actual = getDevPreviewOrdenById(id)
    if (!actual || actual.estado !== 'en_curso') {
      return { ok: false, error: 'Esta orden ya no se puede editar.' }
    }
    devPreviewUpdateOrden(id, {
      ...mapPedidoHeader(parsed.data, actual.creado_por),
      items: parsed.data.items.map((item, idx) => ({
        id: actual.items[idx]?.id ?? id * 100 + idx + 1,
        orden_id: id,
        ...item,
        cantidad_recibida: item.cantidad_recibida ?? null,
        observaciones: item.observaciones.trim() || null,
        orden_linea: idx + 1,
      })),
    })
    return { ok: true, id }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sesión expirada.' }

  const supabase = await createClient()
  const primero = parsed.data.items[0]

  const { error } = await supabase
    .from('ordenes_compra')
    .update({
      ...mapPedidoHeader(parsed.data, user.id),
      codigo_producto: primero.codigo_producto,
      nombre_producto: primero.nombre_producto.trim() || null,
      cantidad: primero.cantidad,
      descripcion: primero.descripcion,
      proveedor_nit: primero.proveedor_nit.trim() || null,
      proveedor_nombre: primero.proveedor_nombre.trim() || null,
      proveedor_email: primero.proveedor_email.trim() || null,
    })
    .eq('id', id)
    .eq('estado', 'en_curso')

  if (error) {
    console.error('Failed to update orden_compra:', error)
    return { ok: false, error: 'No se pudo actualizar la orden.' }
  }

  await supabase.from('orden_compra_items').delete().eq('orden_id', id)
  const { error: itemsError } = await supabase
    .from('orden_compra_items')
    .insert(mapItemsInsert(id, parsed.data))

  if (itemsError) {
    console.error('Failed to update orden_compra_items:', itemsError)
    return { ok: false, error: 'No se pudieron actualizar los ítems.' }
  }

  return { ok: true, id }
}

export async function actualizarEstadoOrdenCompra(
  id: number,
  estado: EstadoOrdenCompra
): Promise<OrdenCompraResultado> {
  const ahora = new Date().toISOString()

  if (isDevBypassActive()) {
    devPreviewUpdateOrden(id, {
      estado,
      finalizada_at: estado === 'listo' ? ahora : null,
    })
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sesión expirada.' }

  const supabase = await createClient()
  const patch: Record<string, string | null> = {
    estado,
    updated_at: ahora,
    finalizada_at: estado === 'listo' ? ahora : null,
  }

  const { error } = await supabase.from('ordenes_compra').update(patch).eq('id', id)

  if (error) {
    return { ok: false, error: 'No se pudo actualizar el estado.' }
  }

  return { ok: true }
}

export async function actualizarObservacionesEntrega(
  id: number,
  observacionesEntrega: string
): Promise<OrdenCompraResultado> {
  if (isDevBypassActive()) {
    devPreviewUpdateOrden(id, { observaciones_entrega: observacionesEntrega.trim() || null })
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sesión expirada.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('ordenes_compra')
    .update({
      observaciones_entrega: observacionesEntrega.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return { ok: false, error: 'No se pudieron guardar las observaciones.' }
  }

  return { ok: true }
}

export async function marcarOrdenDescargadaSiigo(id: number): Promise<OrdenCompraResultado> {
  const ahora = new Date().toISOString()

  if (isDevBypassActive()) {
    devPreviewUpdateOrden(id, { descargada_siigo_at: ahora })
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sesión expirada.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('ordenes_compra')
    .update({ descargada_siigo_at: ahora, updated_at: ahora })
    .eq('id', id)

  if (error) {
    return { ok: false, error: 'No se pudo registrar la descarga.' }
  }

  return { ok: true }
}

export async function finalizarOrdenCompra(
  id: number,
  siigoReferencia?: string
): Promise<OrdenCompraResultado> {
  return actualizarEstadoOrdenCompra(id, 'listo').then(async (res) => {
    if (!res.ok) return res

    const ref = siigoReferencia?.trim()
    if (!ref) return res

    if (isDevBypassActive()) {
      devPreviewUpdateOrden(id, { siigo_referencia: ref })
      return res
    }

    const supabase = await createClient()
    await supabase
      .from('ordenes_compra')
      .update({ siigo_referencia: ref, updated_at: new Date().toISOString() })
      .eq('id', id)

    return res
  })
}

export async function cancelarOrdenCompra(id: number): Promise<OrdenCompraResultado> {
  return actualizarEstadoOrdenCompra(id, 'cancelada')
}

export async function eliminarOrdenCompra(id: number): Promise<OrdenCompraResultado> {
  if (isDevBypassActive()) {
    if (!devPreviewDeleteOrden(id)) {
      return { ok: false, error: 'No se pudo borrar la orden.' }
    }
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sesión expirada.' }

  const supabase = await createClient()
  const { error } = await supabase.from('ordenes_compra').delete().eq('id', id).eq('estado', 'en_curso')

  if (error) {
    return { ok: false, error: 'No se pudo borrar la orden.' }
  }

  return { ok: true }
}

/** @deprecated Usar crearOrdenCompraPedido */
export async function crearOrdenCompra(): Promise<OrdenCompraResultado> {
  return { ok: false, error: 'Usa la sección Compras para crear órdenes.' }
}

/** @deprecated */
export async function actualizarOrdenCompra(): Promise<OrdenCompraResultado> {
  return { ok: false, error: 'Usa la sección Compras para editar órdenes.' }
}

/** @deprecated */
export async function enviarOrdenCompra(): Promise<OrdenCompraResultado> {
  return { ok: true }
}
