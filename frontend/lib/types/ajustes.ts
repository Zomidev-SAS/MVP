import { z } from 'zod'

export const solicitarAjusteSchema = z.object({
  codigo_producto: z.string().trim().min(1, 'El código de producto es requerido'),
  bodega: z.string().trim().min(1, 'La bodega es requerida'),
  cantidad: z.coerce.number().refine((v) => v !== 0, 'La cantidad no puede ser cero'),
  valor_unitario: z.coerce.number().min(0).optional(),
  motivo: z.string().trim().min(1, 'El motivo es requerido'),
})

export type SolicitarAjusteInput = z.infer<typeof solicitarAjusteSchema>

export interface AjustePendiente {
  id: number
  codigo_producto: string
  cantidad: number
  bodega: string
  motivo: string
  solicitado_por: string
  created_at: string
}

export interface AjusteMio {
  id: number
  codigo_producto: string
  cantidad: number
  bodega: string
  motivo: string
  estado: 'pendiente' | 'aprobado' | 'rechazado'
  motivo_rechazo: string | null
  created_at: string
  resuelto_at: string | null
}

export type AjusteResultado = { ok: true } | { ok: false; error: string }
