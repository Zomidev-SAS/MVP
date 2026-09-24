import { z } from 'zod'

export const ESTADOS_ORDEN_COMPRA = ['borrador', 'enviada', 'finalizada', 'cancelada'] as const
export type EstadoOrdenCompra = (typeof ESTADOS_ORDEN_COMPRA)[number]

export const DESTINOS_ENVIO = ['compras', 'proveedor', 'ambos'] as const
export type DestinoEnvio = (typeof DESTINOS_ENVIO)[number]

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

export const guardarOrdenCompraSchema = z
  .object({
    codigo_producto: z.string().trim().min(1),
    nombre_producto: z.string().trim(),
    fecha_pedido: fechaSchema,
    cantidad: z.number().positive('La cantidad debe ser mayor a cero'),
    descripcion: z.string().trim().min(1, 'Indica qué se pidió'),
    proveedor_nit: z.string().trim(),
    proveedor_nombre: z.string().trim(),
    proveedor_email: z.string().trim(),
    destino_envio: z.enum(DESTINOS_ENVIO),
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

export type GuardarOrdenCompraInput = z.infer<typeof guardarOrdenCompraSchema>

export interface OrdenCompra {
  id: number
  codigo_producto: string
  nombre_producto: string | null
  fecha_pedido: string
  cantidad: number
  descripcion: string
  proveedor_nit: string | null
  proveedor_nombre: string | null
  proveedor_email: string | null
  destino_envio: DestinoEnvio
  estado: EstadoOrdenCompra
  observaciones: string | null
  creado_por: string
  enviado_a_compras_at: string | null
  enviado_a_proveedor_at: string | null
  descargada_siigo_at: string | null
  finalizada_at: string | null
  siigo_referencia: string | null
  created_at: string
  updated_at: string
}

export type OrdenCompraResultado = { ok: true } | { ok: false; error: string }

export const ETIQUETA_ESTADO_OC: Record<EstadoOrdenCompra, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
}

export const ETIQUETA_DESTINO: Record<DestinoEnvio, string> = {
  compras: 'Área de compras',
  proveedor: 'Proveedor',
  ambos: 'Compras y proveedor',
}
