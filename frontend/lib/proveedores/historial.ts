import { diferenciaEnDias, fechaDeTimestamp } from '@/lib/proveedores/fechas'
import type { EstadoOrdenCompra } from '@/lib/types/orden-compra'

/** Una OC con solo las líneas de un proveedor, lista para armar su fila del historial. */
export interface OrdenParaHistorial {
  id: number
  numero_oc: string | null
  fecha_pedido: string
  fecha_vencimiento: string | null
  fecha_cierre: string | null
  finalizada_at: string | null
  estado: EstadoOrdenCompra
  factura_proveedor_prefijo: string | null
  factura_proveedor_numero: string | null
  /** Solo las líneas de este proveedor. */
  items: { cantidad: number; cantidad_recibida: number | null }[]
  /** Timestamps de las entregas parciales de las líneas de este proveedor. */
  recepciones: string[]
}

/** Una fila del cuadro de control de entregas de un proveedor (una por OC). */
export interface FilaHistorial {
  clave: string
  orden_id: number | null
  numero_oc: string | null
  fecha_oc: string | null
  estado: EstadoOrdenCompra | 'historico'
  fecha_entrega_prometida: string | null
  fecha_entrega_real: string | null
  /** Real menos prometida, en días. Negativo = llegó antes. */
  diferencia_dias: number | null
  cantidad_pedida: number | null
  cantidad_recibida: number | null
  factura_remision: string | null
  devoluciones: number
}

export function etiquetaOrden(fila: Pick<FilaHistorial, 'numero_oc' | 'orden_id'>): string {
  if (fila.numero_oc) return fila.numero_oc
  return fila.orden_id != null ? `OC ${fila.orden_id}` : 'Sin número'
}

/**
 * Fecha real de entrega: la de la entrega que completó el pedido; si no hay registro de
 * entregas, la fecha de cierre de la orden. Una orden aún abierta y sin completar no tiene fecha.
 */
export function fechaRealEntrega(orden: OrdenParaHistorial, completa: boolean): string | null {
  if (completa && orden.recepciones.length > 0) {
    const ultima = [...orden.recepciones].sort().at(-1) ?? null
    return fechaDeTimestamp(ultima)
  }
  if (orden.estado === 'listo') {
    return orden.fecha_cierre ?? fechaDeTimestamp(orden.finalizada_at)
  }
  return null
}

function sumar(valores: Array<number | null>): number | null {
  const utiles = valores.filter((v): v is number => v != null)
  return utiles.length === 0 ? null : utiles.reduce((total, v) => total + v, 0)
}

/** Historial de un proveedor: una fila por OC, la más reciente primero. */
export function construirFilasHistorial(ordenes: OrdenParaHistorial[]): FilaHistorial[] {
  return ordenes
    .map((orden): FilaHistorial => {
      const pedida = sumar(orden.items.map((i) => i.cantidad))
      const recibida = sumar(orden.items.map((i) => i.cantidad_recibida))
      const completa = pedida != null && pedida > 0 && (recibida ?? 0) >= pedida
      const real = fechaRealEntrega(orden, completa)
      const factura = [orden.factura_proveedor_prefijo, orden.factura_proveedor_numero]
        .map((parte) => parte?.trim())
        .filter(Boolean)
        .join('-')

      return {
        clave: `oc-${orden.id}`,
        orden_id: orden.id,
        numero_oc: orden.numero_oc,
        fecha_oc: orden.fecha_pedido,
        estado: orden.estado,
        fecha_entrega_prometida: orden.fecha_vencimiento,
        fecha_entrega_real: real,
        diferencia_dias: diferenciaEnDias(orden.fecha_vencimiento, real),
        cantidad_pedida: pedida,
        cantidad_recibida: recibida,
        factura_remision: factura === '' ? null : factura,
        devoluciones: 0,
      }
    })
    .sort((a, b) => (b.fecha_oc ?? '').localeCompare(a.fecha_oc ?? ''))
}
