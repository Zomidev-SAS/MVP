import type { ConfigDesempeno } from '@/lib/proveedores/desempeno'
import { esMigracionPendiente } from '@/lib/proveedores/errores'
import {
  construirFilasHistorial,
  type FilaHistorial,
  type OrdenParaHistorial,
} from '@/lib/proveedores/historial'
import type { createClient } from '@/lib/supabase/server'
import type { EstadoOrdenCompra } from '@/lib/types/orden-compra'
import type { DesempenoRegistro } from '@/lib/types/proveedor-desempeno'

type Cliente = Awaited<ReturnType<typeof createClient>>

const TAMANO_PAGINA = 1000
const TAMANO_CONSULTA_IN = 150

const SELECT_ORDEN =
  'id, numero_oc, fecha_pedido, fecha_vencimiento, estado, finalizada_at, factura_proveedor_prefijo, factura_proveedor_numero'

export const SELECT_DESEMPENO =
  'id, proveedor_id, orden_id, numero_oc, fecha_oc, fecha_entrega_prometida, fecha_entrega_real, factura_remision, cantidad_pedida, cantidad_recibida, calidad, calidad_comentario, devoluciones, devoluciones_detalle, cantidad_observaciones, pagos_acordados, tiempo_observaciones, observaciones, actualizado_por_nombre, updated_at'

type OrdenRow = {
  id: number
  numero_oc: string | null
  fecha_pedido: string
  fecha_vencimiento: string | null
  estado: EstadoOrdenCompra
  finalizada_at: string | null
  factura_proveedor_prefijo: string | null
  factura_proveedor_numero: string | null
  fecha_cierre?: string | null
}

type FilasOrdenes = { data: OrdenRow[] | null; error: { code?: string } | null }

type ItemRow = {
  id: number
  orden_id: number
  cantidad: number
  cantidad_recibida: number | null
  proveedor_nit_normalizado: string
}

export function enLotes<T>(lista: T[], tamano: number): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < lista.length; i += tamano) lotes.push(lista.slice(i, i + tamano))
  return lotes
}

export class ErrorHistorial extends Error {
  constructor(
    message: string,
    readonly migracionPendiente: boolean
  ) {
    super(message)
  }
}

/**
 * Historial (con desempeño y puntajes) de los proveedores pedidos, por id de proveedor.
 * Con un solo proveedor filtra las líneas en la base; con varios las recorre todas por páginas.
 */
export async function cargarHistoriales(
  supabase: Cliente,
  proveedores: { id: number; nit_normalizado: string }[],
  config: ConfigDesempeno
): Promise<Map<number, FilaHistorial[]>> {
  const resultado = new Map<number, FilaHistorial[]>(proveedores.map((p) => [p.id, []]))
  if (proveedores.length === 0) return resultado

  const idPorNit = new Map(proveedores.map((p) => [p.nit_normalizado, p.id]))

  // Líneas de OC de esos proveedores (por páginas, el límite de Supabase es 1000 filas).
  const items: ItemRow[] = []
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    let consulta = supabase
      .from('orden_compra_items')
      .select('id, orden_id, cantidad, cantidad_recibida, proveedor_nit_normalizado')
    consulta =
      proveedores.length === 1
        ? consulta.eq('proveedor_nit_normalizado', proveedores[0].nit_normalizado)
        : consulta.not('proveedor_nit_normalizado', 'is', null)

    const { data, error } = await consulta
      .order('id', { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1)

    if (error) {
      throw new ErrorHistorial('No se pudo cargar el historial.', esMigracionPendiente(error))
    }
    const pagina = (data ?? []) as ItemRow[]
    items.push(...pagina.filter((i) => idPorNit.has(i.proveedor_nit_normalizado)))
    if (pagina.length < TAMANO_PAGINA) break
  }

  const ordenIds = [...new Set(items.map((i) => i.orden_id))]

  const ordenes = new Map<number, OrdenRow>()
  for (const lote of enLotes(ordenIds, TAMANO_CONSULTA_IN)) {
    // fecha_cierre llega con la migración 079: si aún no existe se pide sin ella.
    let respuesta = (await supabase
      .from('ordenes_compra')
      .select(`${SELECT_ORDEN}, fecha_cierre`)
      .in('id', lote)) as unknown as FilasOrdenes
    if (respuesta.error?.code === '42703') {
      respuesta = (await supabase
        .from('ordenes_compra')
        .select(SELECT_ORDEN)
        .in('id', lote)) as unknown as FilasOrdenes
    }
    if (respuesta.error) throw new ErrorHistorial('No se pudo cargar el historial.', false)
    for (const orden of respuesta.data ?? []) ordenes.set(orden.id, orden)
  }

  const recepcionesPorItem = new Map<number, string[]>()
  for (const lote of enLotes(ordenIds, TAMANO_CONSULTA_IN)) {
    const { data, error } = await supabase
      .from('orden_compra_recepciones')
      .select('item_id, created_at')
      .in('orden_id', lote)
    if (error) {
      // Sin entregas parciales la fecha real se toma de la fecha de cierre de la orden.
      console.error('Failed to load recepciones for historial:', error)
      break
    }
    for (const r of (data ?? []) as { item_id: number | null; created_at: string }[]) {
      if (r.item_id == null) continue
      const lista = recepcionesPorItem.get(r.item_id) ?? []
      lista.push(r.created_at)
      recepcionesPorItem.set(r.item_id, lista)
    }
  }

  const registrosPorProveedor = new Map<number, DesempenoRegistro[]>()
  for (const lote of enLotes(
    proveedores.map((p) => p.id),
    TAMANO_CONSULTA_IN
  )) {
    const { data, error } = await supabase
      .from('proveedor_desempeno')
      .select(SELECT_DESEMPENO)
      .in('proveedor_id', lote)
    if (error) {
      // Sin la migración 081 el historial se arma solo con lo que dicen las OC.
      if (!esMigracionPendiente(error)) console.error('Failed to load proveedor_desempeno:', error)
      break
    }
    for (const r of (data ?? []) as DesempenoRegistro[]) {
      const lista = registrosPorProveedor.get(r.proveedor_id) ?? []
      lista.push({ ...r, devoluciones: Number(r.devoluciones ?? 0) })
      registrosPorProveedor.set(r.proveedor_id, lista)
    }
  }

  // Agrupa líneas por (proveedor, orden).
  const itemsPorProveedorOrden = new Map<string, ItemRow[]>()
  for (const item of items) {
    const proveedorId = idPorNit.get(item.proveedor_nit_normalizado)!
    const clave = `${proveedorId}:${item.orden_id}`
    const lista = itemsPorProveedorOrden.get(clave) ?? []
    lista.push(item)
    itemsPorProveedorOrden.set(clave, lista)
  }

  const ordenesPorProveedor = new Map<number, OrdenParaHistorial[]>()
  for (const [clave, lineas] of itemsPorProveedorOrden) {
    const [proveedorId, ordenId] = clave.split(':').map(Number)
    const orden = ordenes.get(ordenId)
    if (!orden) continue
    const lista = ordenesPorProveedor.get(proveedorId) ?? []
    lista.push({
      id: orden.id,
      numero_oc: orden.numero_oc,
      fecha_pedido: orden.fecha_pedido,
      fecha_vencimiento: orden.fecha_vencimiento,
      fecha_cierre: orden.fecha_cierre ?? null,
      finalizada_at: orden.finalizada_at,
      estado: orden.estado,
      factura_proveedor_prefijo: orden.factura_proveedor_prefijo,
      factura_proveedor_numero: orden.factura_proveedor_numero,
      items: lineas.map((i) => ({
        cantidad: Number(i.cantidad),
        cantidad_recibida: i.cantidad_recibida == null ? null : Number(i.cantidad_recibida),
      })),
      recepciones: lineas.flatMap((i) => recepcionesPorItem.get(i.id) ?? []),
    })
    ordenesPorProveedor.set(proveedorId, lista)
  }

  for (const proveedor of proveedores) {
    resultado.set(
      proveedor.id,
      construirFilasHistorial(
        ordenesPorProveedor.get(proveedor.id) ?? [],
        registrosPorProveedor.get(proveedor.id) ?? [],
        config
      )
    )
  }

  return resultado
}
