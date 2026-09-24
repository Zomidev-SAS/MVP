'use server'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import {
  devPreviewDeleteOrden,
  devPreviewInsertOrden,
  devPreviewUpdateOrden,
  getDevPreviewOrdenesCompra,
  getDevPreviewOrdenesPendientesCount,
} from '@/lib/dev/preview-ordenes-compra-data'
import {
  guardarOrdenCompraSchema,
  type GuardarOrdenCompraInput,
  type OrdenCompra,
  type OrdenCompraResultado,
} from '@/lib/types/orden-compra'

const SELECT_COLS =
  'id, codigo_producto, nombre_producto, fecha_pedido, cantidad, descripcion, proveedor_nit, proveedor_nombre, proveedor_email, destino_envio, estado, observaciones, creado_por, enviado_a_compras_at, enviado_a_proveedor_at, descargada_siigo_at, finalizada_at, siigo_referencia, created_at, updated_at'

export async function fetchOrdenesCompraProducto(codigoProducto: string): Promise<OrdenCompra[]> {
  if (isDevBypassActive()) {
    return getDevPreviewOrdenesCompra(codigoProducto)
  }

  const user = await getSessionUser()
  if (!user) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ordenes_compra')
    .select(SELECT_COLS)
    .eq('codigo_producto', codigoProducto)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load ordenes_compra:', error)
    return []
  }

  return (data ?? []) as OrdenCompra[]
}

export async function fetchOrdenesCompraPendientes(): Promise<OrdenCompra[]> {
  if (isDevBypassActive()) {
    return getDevPreviewOrdenesCompra().filter((o) => o.estado === 'enviada')
  }

  const user = await getSessionUser()
  if (!user) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ordenes_compra')
    .select(SELECT_COLS)
    .eq('estado', 'enviada')
    .order('enviado_a_compras_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Failed to load ordenes pendientes:', error)
    return []
  }

  return (data ?? []) as OrdenCompra[]
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
    .eq('estado', 'enviada')

  if (error) {
    console.error('Failed to count ordenes pendientes:', error)
    return 0
  }

  return count ?? 0
}

function mapInputToRow(datos: GuardarOrdenCompraInput, userId: string) {
  return {
    codigo_producto: datos.codigo_producto,
    nombre_producto: datos.nombre_producto.trim() || null,
    fecha_pedido: datos.fecha_pedido,
    cantidad: datos.cantidad,
    descripcion: datos.descripcion,
    proveedor_nit: datos.proveedor_nit || null,
    proveedor_nombre: datos.proveedor_nombre || null,
    proveedor_email: datos.proveedor_email || null,
    destino_envio: datos.destino_envio,
    observaciones: datos.observaciones || null,
    creado_por: userId,
    updated_at: new Date().toISOString(),
  }
}

export async function crearOrdenCompra(datos: GuardarOrdenCompraInput): Promise<OrdenCompraResultado> {
  const parsed = guardarOrdenCompraSchema.safeParse(datos)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos. Revisa el formulario.' }
  }

  if (isDevBypassActive()) {
    await new Promise((r) => setTimeout(r, 400))
    devPreviewInsertOrden({
      ...mapInputToRow(parsed.data, 'dev-preview-user'),
      estado: 'borrador',
      enviado_a_compras_at: null,
      enviado_a_proveedor_at: null,
      descargada_siigo_at: null,
      finalizada_at: null,
      siigo_referencia: null,
    })
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sesión expirada.' }

  const supabase = await createClient()
  const { error } = await supabase.from('ordenes_compra').insert({
    ...mapInputToRow(parsed.data, user.id),
    estado: 'borrador',
  })

  if (error) {
    console.error('Failed to insert orden_compra:', error)
    return { ok: false, error: 'No se pudo crear la orden de compra.' }
  }

  return { ok: true }
}

export async function actualizarOrdenCompra(
  id: number,
  datos: GuardarOrdenCompraInput
): Promise<OrdenCompraResultado> {
  const parsed = guardarOrdenCompraSchema.safeParse(datos)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos. Revisa el formulario.' }
  }

  if (isDevBypassActive()) {
    await new Promise((r) => setTimeout(r, 400))
    const actual = getDevPreviewOrdenesCompra().find((o) => o.id === id)
    if (!actual || !['borrador', 'enviada'].includes(actual.estado)) {
      return { ok: false, error: 'Esta orden ya no se puede editar.' }
    }
    devPreviewUpdateOrden(id, mapInputToRow(parsed.data, actual.creado_por))
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sesión expirada.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('ordenes_compra')
    .update(mapInputToRow(parsed.data, user.id))
    .eq('id', id)
    .in('estado', ['borrador', 'enviada'])

  if (error) {
    console.error('Failed to update orden_compra:', error)
    return { ok: false, error: 'No se pudo actualizar la orden.' }
  }

  return { ok: true }
}

async function notificarCompras(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orden: { id: number; codigo_producto: string; descripcion: string; cantidad: number }
) {
  const { error } = await supabase.from('mensajes_panel').insert({
    titulo: `Orden de compra #${orden.id}`,
    cuerpo: `${orden.codigo_producto}: ${orden.descripcion} (${orden.cantidad} uds). Descarga el CSV desde inventario y carga la OC en Siigo Nube.`,
    nivel: 'aviso',
    rol_destino: 'compras',
    created_by: userId,
  })
  if (error) {
    console.error('Failed to notify compras:', error)
  }
}

export async function enviarOrdenCompra(id: number): Promise<OrdenCompraResultado> {
  const ahora = new Date().toISOString()

  if (isDevBypassActive()) {
    await new Promise((r) => setTimeout(r, 400))
    const orden = getDevPreviewOrdenesCompra().find((o) => o.id === id)
    if (!orden) return { ok: false, error: 'Orden no encontrada.' }
    if (orden.estado !== 'borrador') return { ok: false, error: 'Solo se pueden enviar borradores.' }
    devPreviewUpdateOrden(id, {
      estado: 'enviada',
      enviado_a_compras_at: ahora,
      enviado_a_proveedor_at:
        orden.destino_envio === 'proveedor' || orden.destino_envio === 'ambos' ? ahora : null,
    })
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sesión expirada.' }

  const supabase = await createClient()
  const { data: orden, error: fetchError } = await supabase
    .from('ordenes_compra')
    .select('id, codigo_producto, descripcion, cantidad, destino_envio, estado')
    .eq('id', id)
    .single()

  if (fetchError || !orden) {
    return { ok: false, error: 'Orden no encontrada.' }
  }

  if (orden.estado !== 'borrador') {
    return { ok: false, error: 'Solo se pueden enviar borradores.' }
  }

  const patch: Record<string, string | null> = {
    estado: 'enviada',
    enviado_a_compras_at: ahora,
    updated_at: ahora,
  }

  if (orden.destino_envio === 'proveedor' || orden.destino_envio === 'ambos') {
    patch.enviado_a_proveedor_at = ahora
  }

  const { error } = await supabase.from('ordenes_compra').update(patch).eq('id', id)

  if (error) {
    console.error('Failed to send orden_compra:', error)
    return { ok: false, error: 'No se pudo enviar la orden.' }
  }

  if (orden.destino_envio === 'compras' || orden.destino_envio === 'ambos') {
    await notificarCompras(supabase, user.id, orden)
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
    .eq('estado', 'enviada')

  if (error) {
    return { ok: false, error: 'No se pudo registrar la descarga.' }
  }

  return { ok: true }
}

export async function finalizarOrdenCompra(
  id: number,
  siigoReferencia?: string
): Promise<OrdenCompraResultado> {
  const ahora = new Date().toISOString()

  if (isDevBypassActive()) {
    await new Promise((r) => setTimeout(r, 400))
    const orden = getDevPreviewOrdenesCompra().find((o) => o.id === id)
    if (!orden) return { ok: false, error: 'Orden no encontrada.' }
    if (orden.estado !== 'enviada') {
      return { ok: false, error: 'Solo se pueden finalizar órdenes enviadas.' }
    }
    devPreviewUpdateOrden(id, {
      estado: 'finalizada',
      finalizada_at: ahora,
      siigo_referencia: siigoReferencia?.trim() || null,
    })
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sesión expirada.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('ordenes_compra')
    .update({
      estado: 'finalizada',
      finalizada_at: ahora,
      siigo_referencia: siigoReferencia?.trim() || null,
      updated_at: ahora,
    })
    .eq('id', id)
    .eq('estado', 'enviada')

  if (error) {
    console.error('Failed to finalize orden_compra:', error)
    return { ok: false, error: 'No se pudo finalizar la orden.' }
  }

  return { ok: true }
}

export async function cancelarOrdenCompra(id: number): Promise<OrdenCompraResultado> {
  const ahora = new Date().toISOString()

  if (isDevBypassActive()) {
    const orden = getDevPreviewOrdenesCompra().find((o) => o.id === id)
    if (!orden || !['borrador', 'enviada'].includes(orden.estado)) {
      return { ok: false, error: 'Esta orden no se puede cancelar.' }
    }
    devPreviewUpdateOrden(id, { estado: 'cancelada', updated_at: ahora })
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sesión expirada.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('ordenes_compra')
    .update({ estado: 'cancelada', updated_at: ahora })
    .eq('id', id)
    .in('estado', ['borrador', 'enviada'])

  if (error) {
    return { ok: false, error: 'No se pudo cancelar la orden.' }
  }

  return { ok: true }
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
  const { error } = await supabase.from('ordenes_compra').delete().eq('id', id).eq('estado', 'borrador')

  if (error) {
    return { ok: false, error: 'No se pudo borrar la orden.' }
  }

  return { ok: true }
}
