import { z } from 'zod'

export const ESTADOS_ORDEN_COMPRA = ['en_curso', 'listo', 'cancelada'] as const
export type EstadoOrdenCompra = (typeof ESTADOS_ORDEN_COMPRA)[number]

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
const fechaOpcionalSchema = z.union([fechaSchema, z.literal('')])

export const ordenCompraItemSchema = z
  .object({
    codigo_producto: z.string().trim().min(1, 'Indica el código'),
    nombre_producto: z.string().trim(),
    cantidad: z.number().positive('Cantidad mayor a cero'),
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
  titulo: z.string().trim().min(1, 'Indica un nombre para la orden'),
  fecha_pedido: fechaSchema,
  fecha_vencimiento: fechaOpcionalSchema,
  observaciones: z.string().trim(),
  observaciones_entrega: z.string().trim(),
  items: z.array(ordenCompraItemSchema).min(1, 'Agrega al menos un producto'),
})

export type GuardarOrdenCompraPedidoInput = z.infer<typeof guardarOrdenCompraPedidoSchema>

export interface OrdenCompraItem {
  id: number
  orden_id: number
  codigo_producto: string
  nombre_producto: string | null
  cantidad: number
  cantidad_recibida: number | null
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
  creado_por: string
  descargada_siigo_at: string | null
  finalizada_at: string | null
  siigo_referencia: string | null
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
  en_curso: 'bg-amber-100 text-amber-900 border-amber-200',
  listo: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  cancelada: 'bg-muted text-muted-foreground border-border',
}

export function tituloOrdenDisplay(orden: OrdenCompra): string {
  if (orden.titulo?.trim()) return orden.titulo.trim()
  const prov = orden.items[0]?.proveedor_nombre ?? orden.proveedor_nombre
  return prov ? `${prov} OC ${orden.id}` : `OC ${orden.id}`
}

export function itemVacio(): OrdenCompraItemInput {
  return {
    codigo_producto: '',
    nombre_producto: '',
    cantidad: 1,
    cantidad_recibida: null,
    descripcion: '',
    proveedor_nit: '',
    proveedor_nombre: '',
    proveedor_email: '',
    observaciones: '',
  }
}
