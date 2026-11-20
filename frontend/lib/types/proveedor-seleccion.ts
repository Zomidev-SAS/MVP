import { z } from 'zod'
import { CALIDADES, type Calidad } from '@/lib/proveedores/desempeno'

export const ESTADOS_SELECCION = ['borrador', 'decidida'] as const
export type EstadoSeleccion = (typeof ESTADOS_SELECCION)[number]

export const candidatoSchema = z
  .object({
    proveedor_id: z.number().int().positive().nullable(),
    nombre_nuevo: z.string().trim().max(200),
    precio: z.number().min(0, 'El precio no puede ser negativo').nullable(),
    tiempo_entrega_dias: z.number().min(0, 'Los días no pueden ser negativos').nullable(),
    calidad: z.enum(CALIDADES).nullable(),
    observaciones: z.string().trim().max(1000),
  })
  .refine((c) => c.proveedor_id != null || c.nombre_nuevo.length > 0, {
    message: 'Elige un proveedor o escribe el nombre del nuevo',
    path: ['nombre_nuevo'],
  })

export type CandidatoInput = z.infer<typeof candidatoSchema>

export const guardarSeleccionSchema = z
  .object({
    id: z.number().int().positive().nullable(),
    titulo: z.string().trim().min(1, 'Ponle un título a la evaluación').max(200),
    necesidad: z.string().trim().max(2000),
    estado: z.enum(ESTADOS_SELECCION),
    /** Índice del candidato elegido dentro de la lista, o null si aún no se decide. */
    elegido: z.number().int().min(0).nullable(),
    conclusion: z.string().trim().max(4000),
    candidatos: z.array(candidatoSchema).min(2, 'Compara al menos dos proveedores').max(10),
  })
  .refine((s) => s.estado === 'borrador' || s.elegido != null, {
    message: 'Para marcarla como decidida, elige el proveedor ganador',
    path: ['elegido'],
  })
  .refine((s) => s.elegido == null || s.elegido < s.candidatos.length, {
    message: 'El proveedor elegido no está en la lista',
    path: ['elegido'],
  })

export type GuardarSeleccionInput = z.infer<typeof guardarSeleccionSchema>

export interface Candidato {
  id: number
  proveedor_id: number | null
  /** Nombre a mostrar: el del catálogo o el del proveedor nuevo. */
  nombre: string
  es_nuevo: boolean
  precio: number | null
  tiempo_entrega_dias: number | null
  calidad: Calidad | null
  observaciones: string | null
  orden: number
}

export interface Seleccion {
  id: number
  titulo: string
  necesidad: string | null
  estado: EstadoSeleccion
  proveedor_elegido_id: number | null
  nombre_elegido: string | null
  conclusion: string | null
  creado_por_nombre: string | null
  created_at: string
  updated_at: string
  candidatos: Candidato[]
}

export type SeleccionResumen = Omit<Seleccion, 'candidatos'> & { total_candidatos: number }

export interface ReferenciaProveedor {
  /** Días promedio entre la orden y la entrega real, en sus órdenes finalizadas. */
  tiempo_promedio_dias: number | null
  /** Promedio del puntaje de calidad (0–100) de sus órdenes calificadas. */
  calidad_indice: number | null
}

export type SeleccionResultado = { ok: true; id: number } | { ok: false; error: string }
