import { z } from 'zod'
import type { PesosDesempeno } from '@/lib/proveedores/desempeno'

export const RESULTADOS_REEVALUACION = ['continuar', 'no_continuar'] as const
export type ResultadoReevaluacion = (typeof RESULTADOS_REEVALUACION)[number]

export const ETIQUETA_RESULTADO: Record<ResultadoReevaluacion, string> = {
  continuar: 'Continuar con el proveedor',
  no_continuar: 'No continuar',
}

export const guardarReevaluacionSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  resultado: z.enum(RESULTADOS_REEVALUACION),
  motivo: z.string().trim().max(2000),
})

export type GuardarReevaluacionInput = z.infer<typeof guardarReevaluacionSchema>

/** Copia del cálculo al momento de reevaluar, para que la constancia no cambie después. */
export interface DetalleReevaluacion {
  total: number
  calificadas: number
  promedios: {
    calidad: number | null
    devoluciones: number | null
    cantidad: number | null
    tiempo: number | null
  }
  conRetraso: number
  devoluciones: number
  diasRetrasoPromedio: number | null
  pesos: PesosDesempeno
  penalizacionDia: number
  penalizacionDevolucion: number
}

export interface Reevaluacion {
  id: number
  proveedor_id: number
  anio: number
  porcentaje: number
  umbral: number
  resultado: ResultadoReevaluacion
  motivo: string | null
  detalle: DetalleReevaluacion
  creado_por_nombre: string | null
  created_at: string
  updated_at: string
}

export type ReevaluacionResultado = { ok: true } | { ok: false; error: string }
