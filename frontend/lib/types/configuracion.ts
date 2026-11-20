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

export interface UmbralCategoria {
  categoria: string
  umbral: number
  // productos de la categoría que hoy están en o bajo ese umbral (saldo > 0)
  en_alerta: number
}

export interface UmbralesCategoriaData {
  categorias: string[]
  umbrales: UmbralCategoria[]
  // si falla la carga (p. ej. falta aplicar la migración 072) viene el motivo
  error: string | null
}

export const umbralCategoriaSchema = z.object({
  categoria: z.string().min(1, 'Elige una categoría'),
  umbral: z.number().int('Debe ser un número entero').min(0, 'Debe ser 0 o mayor').max(1000000),
})

export type ConfiguracionResultado = { ok: true } | { ok: false; error: string }
