import { z } from 'zod'

export const entradaSchema = z.object({
  codigo_producto: z.string().trim().min(1, 'El código de producto es requerido'),
  bodega: z.string().trim().min(1, 'La bodega es requerida'),
  cantidad: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  valor_unitario: z.coerce.number().min(0, 'El valor unitario no puede ser negativo').optional(),
  motivo: z.string().trim().optional(),
})

export type EntradaInput = z.infer<typeof entradaSchema>

export type EntradaResultado = { ok: true } | { ok: false; error: string }
