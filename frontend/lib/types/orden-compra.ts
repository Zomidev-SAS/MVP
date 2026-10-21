import { z } from 'zod'

export const ESTADOS_ORDEN_COMPRA = ['en_curso', 'listo', 'cancelada'] as const
export type EstadoOrdenCompra = (typeof ESTADOS_ORDEN_COMPRA)[number]

export const MEDIOS_PAGO_OC = ['credito', 'contado'] as const
export type MedioPagoOC = (typeof MEDIOS_PAGO_OC)[number]

export const ETIQUETA_MEDIO_PAGO: Record<MedioPagoOC, string> = {
  credito: 'Crédito',
  contado: 'Contado',
}

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
const fechaOpcionalSchema = z.union([fechaSchema, z.literal('')])

export const ordenCompraItemSchema = z
  .object({
    codigo_producto: z.string().trim().min(1, 'Indica el código'),
    nombre_producto: z.string().trim(),
    cantidad: z.number().positive('Cantidad mayor a cero'),
    precio_unitario: z.number().min(0, 'El precio no puede ser negativo'),
    cantidad_recibida: z.union([z.number().min(0), z.null()]).optional(),
    descripcion: z.string().trim().min(1, 'Describe el ítem'),
    proveedor_nit: z.string().trim(),
    proveedor_nombre: z.string().trim(),
    proveedor_email: z.string().trim(),
    observaciones: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (data.proveedor_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.proveedor_email)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Email inválido',
        path: ['proveedor_email'],
      })
    }
  })

export type OrdenCompraItemInput = z.infer<typeof ordenCompraItemSchema>

export const guardarOrdenCompraPedidoSchema = z.object({
  // Ya no se pide nombre/tarea; si viene vacío se muestra "Proveedor OC n" (tituloOrdenDisplay).
  titulo: z.string().trim(),
  fecha_pedido: fechaSchema,
  fecha_vencimiento: fechaOpcionalSchema,
  observaciones: z.string().trim(),
  observaciones_entrega: z.string().trim(),
  medio_pago: z.enum(['credito', 'contado']).nullable().optional(),
  items: z.array(ordenCompraItemSchema).min(1, 'Agrega al menos un producto'),
})

export type GuardarOrdenCompraPedidoInput = z.infer<typeof guardarOrdenCompraPedidoSchema>

export interface OrdenCompraItem {
  id: number
  orden_id: number
  codigo_producto: string
  nombre_producto: string | null
  cantidad: number
  /** Costo unitario pactado con el proveedor (0 permitido); null en OC anteriores a la 056. */
  precio_unitario: number | null
  /** Total acumulado recibido (parciales). */
  cantidad_recibida: number | null
  /** Última vez que se actualizó cantidad_recibida. */
  cantidad_recibida_at?: string | null
  descripcion: string
  proveedor_nit: string | null
  proveedor_nombre: string | null
  proveedor_email: string | null
  observaciones: string | null
  orden_linea: number
}

export interface OrdenCompra {
  id: number
  titulo: string | null
  fecha_pedido: string
  fecha_vencimiento: string | null
  estado: EstadoOrdenCompra
  observaciones: string | null
  observaciones_entrega: string | null
  medio_pago: MedioPagoOC | null
  creado_por: string
  descargada_siigo_at: string | null
  finalizada_at: string | null
  siigo_id: string | null
  siigo_estado: 'pendiente' | 'enviando' | 'sincronizada' | 'error' | null
  siigo_referencia: string | null
  /** Número de la OC en Siigo (OC-1-3195) cuando se cargó desde el documento. */
  numero_oc?: string | null
  /** Factura que emitió el proveedor: Siigo la exige para crear la factura de compra. */
  factura_proveedor_prefijo?: string | null
  factura_proveedor_numero?: string | null
  origen?: 'panel' | 'documento_siigo'
  documento_path?: string | null
  documento_firmado_path?: string | null
  firmada_at?: string | null
  firmada_por?: string | null
  total_pagar?: number | null
  created_at: string
  updated_at: string
  items: OrdenCompraItem[]
  /** Campos legacy (primera línea) — compat notificaciones */
  codigo_producto?: string | null
  nombre_producto?: string | null
  cantidad?: number | null
  descripcion?: string | null
  proveedor_nit?: string | null
  proveedor_nombre?: string | null
}

export type OrdenCompraResultado = { ok: true; id?: number } | { ok: false; error: string }

export const ETIQUETA_ESTADO_OC: Record<EstadoOrdenCompra, string> = {
  en_curso: 'En curso',
  listo: 'Listo',
  cancelada: 'Cancelada',
}

export const CLASE_ESTADO_OC: Record<EstadoOrdenCompra, string> = {
  en_curso: 'chip-warning',
  listo: 'chip-success',
  cancelada: 'chip-neutral',
}

export function tituloOrdenDisplay(orden: OrdenCompra): string {
  if (orden.titulo?.trim()) return orden.titulo.trim()
  const prov = orden.items[0]?.proveedor_nombre ?? orden.proveedor_nombre
  if (orden.numero_oc) return prov ? `${prov} · ${orden.numero_oc}` : orden.numero_oc
  return prov ? `${prov} OC ${orden.id}` : `OC ${orden.id}`
}

export interface ResumenRecepcion {
  pedida: number
  recibida: number
  restante: number
  completa: boolean
  parcial: boolean
}

/** Parciales por número: pedidas 100, llegaron 50 → restan 50. */
export function resumenRecepcion(item: Pick<OrdenCompraItem, 'cantidad' | 'cantidad_recibida'>): ResumenRecepcion {
  const pedida = Number(item.cantidad) || 0
  const recibida = Number(item.cantidad_recibida ?? 0) || 0
  const restante = Math.max(pedida - recibida, 0)
  return {
    pedida,
    recibida,
    restante,
    completa: pedida > 0 && recibida >= pedida,
    parcial: recibida > 0 && recibida < pedida,
  }
}

export function itemVacio(): OrdenCompraItemInput {
  return {
    codigo_producto: '',
    nombre_producto: '',
    cantidad: 1,
    precio_unitario: 0,
    cantidad_recibida: null,
    descripcion: '',
    proveedor_nit: '',
    proveedor_nombre: '',
    proveedor_email: '',
    observaciones: '',
  }
}

export interface ProductoSugerido {
  codigo_producto: string
  nombre_producto: string
  unidad_medida: string | null
  categoria: string | null
}

export interface ProveedorSugerido {
  nit: string
  nombre: string | null
  email: string | null
}

/** Última línea de OC registrada para un producto, para autorrellenar precio y proveedor. */
export interface UltimaCompraProducto {
  precio_unitario: number | null
  proveedor_nit: string | null
  proveedor_nombre: string | null
  proveedor_email: string | null
}

export type TipoEventoOrden = 'inicio' | 'parcial' | 'fin' | 'cancelada'

export interface EventoLineaTiempoOrden {
  tipo: TipoEventoOrden
  fecha: string
  /** Texto corto: producto y cantidades. */
  detalle: string
}

export interface OrdenLineaTiempo {
  id: number
  titulo: string
  estado: EstadoOrdenCompra
  pedidas: number
  recibidas: number
  eventos: EventoLineaTiempoOrden[]
}
