import { z } from 'zod'

export const entradaSchema = z.object({
  vin: z.string().trim().min(5, 'El VIN debe tener al menos 5 caracteres'),
  marca: z.string().trim().min(1, 'La marca es requerida'),
  categoria: z.string().trim().min(1, 'La categoría es requerida'),
  cantidad: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  valor_unitario: z.coerce
    .number()
    .min(0, 'El valor unitario no puede ser negativo')
    .optional(),
  ubicacion: z.string().trim().min(1, 'La ubicación es requerida'),
  notas: z.string().trim().optional(),
})

export type EntradaInput = z.infer<typeof entradaSchema>

export type EntradaResultado = { ok: true } | { ok: false; error: string }
