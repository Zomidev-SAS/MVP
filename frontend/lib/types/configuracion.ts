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

// umbral = null significa "sin umbral propio": la categoría usa el umbral general.
export interface UmbralCategoria {
  categoria: string
  umbral: number | null
}

export const umbralesCategoriaSchema = z.array(
  z.object({
    categoria: z.string().min(1),
    umbral: z.number().int().min(0, 'Debe ser 0 o mayor').nullable(),
  })
)

export type ConfiguracionResultado = { ok: true } | { ok: false; error: string }
