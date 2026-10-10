import { z } from 'zod'

export const configuracionSchema = z.object({
  bloquear_sin_stock: z.boolean(),
  umbral_stock_bajo: z.coerce.number().int().min(0, 'Debe ser 0 o mayor'),
})

export type ConfiguracionInput = z.infer<typeof configuracionSchema>

export interface Configuracion {
  bloquear_sin_stock: boolean
  umbral_stock_bajo: number
}

export type ConfiguracionResultado = { ok: true } | { ok: false; error: string }
