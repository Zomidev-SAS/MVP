import { z } from 'zod'

/** Código que devuelven las acciones cuando la tabla o columna todavía no existe en Supabase. */
export const MIGRACION_PENDIENTE = 'migracion_pendiente'

export type OrigenProveedor = 'manual' | 'oc' | 'importado' | 'siigo'

export interface Proveedor {
  id: number
  nit: string
  nit_normalizado: string
  nombre: string
  email: string | null
  telefono: string | null
  contacto: string | null
  notas: string | null
  activo: boolean
  origen: OrigenProveedor
  created_at: string
  updated_at: string
}

export interface UltimaReevaluacion {
  anio: number
  resultado: 'continuar' | 'no_continuar'
  porcentaje: number
}

/** Proveedor con el resumen que se muestra en la lista. */
export interface ProveedorFila extends Proveedor {
  total_ordenes: number
  ordenes_puntuadas: number
  porcentaje_promedio: number | null
  ultima_reevaluacion: UltimaReevaluacion | null
}

export interface ProveedoresListado {
  filas: ProveedorFila[]
  error?: string
}

export const guardarProveedorSchema = z.object({
  nit: z
    .string()
    .trim()
    .min(1, 'El NIT es requerido')
    .refine((valor) => /\d/.test(valor), 'El NIT debe tener números'),
  nombre: z.string().trim().min(1, 'El nombre es requerido'),
  email: z
    .string()
    .trim()
    .refine((valor) => valor === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor), 'Email inválido'),
  telefono: z.string().trim(),
  contacto: z.string().trim(),
  notas: z.string().trim(),
})

export type GuardarProveedorInput = z.infer<typeof guardarProveedorSchema>

export type ProveedorResultado = { ok: true; id?: number } | { ok: false; error: string }

export type ImportarProveedoresResultado =
  | { ok: true; creados: number; actualizados: number }
  | { ok: false; error: string }
