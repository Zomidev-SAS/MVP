import {
  CONFIG_DESEMPENO_DEFAULT,
  calcularPuntajes,
  type Calidad,
  type ConfigDesempeno,
  type PuntajesDesempeno,
} from '@/lib/proveedores/desempeno'
import { diferenciaEnDias, fechaDeTimestamp } from '@/lib/proveedores/fechas'
import type { DesempenoRegistro } from '@/lib/types/proveedor-desempeno'
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

/** Lo que dice la OC, sin lo capturado a mano. Sirve de referencia en el formulario. */
export interface DatosDerivados {
  fecha_entrega_prometida: string | null
  fecha_entrega_real: string | null
  factura_remision: string | null
  cantidad_pedida: number | null
  cantidad_recibida: number | null
}

/** Una fila del cuadro de control de un proveedor: una por OC (o por OC histórica importada). */
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
  desempeno_id: number | null
  calidad: Calidad | null
  calidad_comentario: string | null
  devoluciones_detalle: string | null
  cantidad_observaciones: string | null
  pagos_acordados: string | null
  tiempo_observaciones: string | null
  observaciones: string | null
  actualizado_por_nombre: string | null
  actualizado_en: string | null
  derivado: DatosDerivados
  /** Solo para OC finalizadas o históricas; las que siguen en curso no se califican todavía. */
  puntajes: PuntajesDesempeno | null
}

export function etiquetaOrden(fila: Pick<FilaHistorial, 'numero_oc' | 'orden_id'>): string {
  if (fila.numero_oc) return fila.numero_oc
  return fila.orden_id != null ? `OC ${fila.orden_id}` : 'Sin número'
}

export function seCalifica(estado: FilaHistorial['estado']): boolean {
  return estado === 'listo' || estado === 'historico'
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

function derivarDeOrden(orden: OrdenParaHistorial): DatosDerivados {
  const pedida = sumar(orden.items.map((i) => i.cantidad))
  const recibida = sumar(orden.items.map((i) => i.cantidad_recibida))
  const completa = pedida != null && pedida > 0 && (recibida ?? 0) >= pedida
  const factura = [orden.factura_proveedor_prefijo, orden.factura_proveedor_numero]
    .map((parte) => parte?.trim())
    .filter(Boolean)
    .join('-')
  return {
    fecha_entrega_prometida: orden.fecha_vencimiento,
    fecha_entrega_real: fechaRealEntrega(orden, completa),
    factura_remision: factura === '' ? null : factura,
    cantidad_pedida: pedida,
    cantidad_recibida: recibida,
  }
}

const DERIVADO_VACIO: DatosDerivados = {
  fecha_entrega_prometida: null,
  fecha_entrega_real: null,
  factura_remision: null,
  cantidad_pedida: null,
  cantidad_recibida: null,
}

/** Lo capturado a mano gana sobre lo derivado de la OC. */
function armarFila(
  base: {
    clave: string
    orden_id: number | null
    numero_oc: string | null
    fecha_oc: string | null
    estado: FilaHistorial['estado']
  },
  derivado: DatosDerivados,
  registro: DesempenoRegistro | undefined,
  config: ConfigDesempeno
): FilaHistorial {
  const prometida = registro?.fecha_entrega_prometida ?? derivado.fecha_entrega_prometida
  const real = registro?.fecha_entrega_real ?? derivado.fecha_entrega_real
  const pedida = registro?.cantidad_pedida ?? derivado.cantidad_pedida
  const recibida = registro?.cantidad_recibida ?? derivado.cantidad_recibida
  const devoluciones = registro?.devoluciones ?? 0
  const calidad = registro?.calidad ?? null

  return {
    ...base,
    fecha_entrega_prometida: prometida,
    fecha_entrega_real: real,
    diferencia_dias: diferenciaEnDias(prometida, real),
    cantidad_pedida: pedida,
    cantidad_recibida: recibida,
    factura_remision: registro?.factura_remision ?? derivado.factura_remision,
    devoluciones,
    desempeno_id: registro?.id ?? null,
    calidad,
    calidad_comentario: registro?.calidad_comentario ?? null,
    devoluciones_detalle: registro?.devoluciones_detalle ?? null,
    cantidad_observaciones: registro?.cantidad_observaciones ?? null,
    pagos_acordados: registro?.pagos_acordados ?? null,
    tiempo_observaciones: registro?.tiempo_observaciones ?? null,
    observaciones: registro?.observaciones ?? null,
    actualizado_por_nombre: registro?.actualizado_por_nombre ?? null,
    actualizado_en: registro?.updated_at ?? null,
    derivado,
    puntajes: seCalifica(base.estado)
      ? calcularPuntajes(
          {
            calidad,
            devoluciones,
            cantidadPedida: pedida,
            cantidadRecibida: recibida,
            fechaPrometida: prometida,
            fechaReal: real,
          },
          config
        )
      : null,
  }
}

/**
 * Historial de un proveedor: una fila por OC del panel más las OC históricas importadas,
 * la más reciente primero, con su desempeño y puntajes.
 */
export function construirFilasHistorial(
  ordenes: OrdenParaHistorial[],
  registros: DesempenoRegistro[] = [],
  config: ConfigDesempeno = CONFIG_DESEMPENO_DEFAULT
): FilaHistorial[] {
  const porOrden = new Map(
    registros.filter((r) => r.orden_id != null).map((r) => [r.orden_id as number, r])
  )

  const filasOrden = ordenes.map((orden) =>
    armarFila(
      {
        clave: `oc-${orden.id}`,
        orden_id: orden.id,
        numero_oc: orden.numero_oc,
        fecha_oc: orden.fecha_pedido,
        estado: orden.estado,
      },
      derivarDeOrden(orden),
      porOrden.get(orden.id),
      config
    )
  )

  const filasHistoricas = registros
    .filter((r) => r.orden_id == null)
    .map((registro) =>
      armarFila(
        {
          clave: `hist-${registro.id}`,
          orden_id: null,
          numero_oc: registro.numero_oc,
          fecha_oc: registro.fecha_oc,
          estado: 'historico',
        },
        DERIVADO_VACIO,
        registro,
        config
      )
    )

  return [...filasOrden, ...filasHistoricas].sort((a, b) =>
    (b.fecha_oc ?? '').localeCompare(a.fecha_oc ?? '')
  )
}
