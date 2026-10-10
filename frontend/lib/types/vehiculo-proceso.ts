import { z } from 'zod'

export const guardarProcesoVehiculoSchema = z.object({
  chasis: z.string().trim().min(1),
  titulo: z.string().trim().min(1, 'El título es requerido'),
  procesoEstado: z.string().trim().min(1, 'El proceso/estado es requerido'),
  observaciones: z.string(),
  seccionSiguiente: z.string(),
})

export type GuardarProcesoVehiculoInput = z.infer<typeof guardarProcesoVehiculoSchema>

export interface VehiculoProceso {
  id: string
  chasis: string
  titulo: string
  procesoEstado: string
  observaciones: string | null
  seccionSiguiente: string | null
  creadoPorNombre: string | null
  creadoEn: string | null
}

export type ProcesoVehiculoResultado = { ok: true } | { ok: false; error: string }
