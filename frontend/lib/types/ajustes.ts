import { z } from 'zod'

export const solicitarAjusteSchema = z.object({
  vin: z.string().trim().min(5, 'El VIN debe tener al menos 5 caracteres'),
  cantidad: z.coerce.number().refine((v) => v !== 0, 'La cantidad no puede ser cero'),
  motivo: z.string().trim().min(1, 'El motivo es requerido'),
  evidencia: z.string().trim().optional(),
})

export type SolicitarAjusteInput = z.infer<typeof solicitarAjusteSchema>

export interface AjustePendiente {
  id: number
  vin: string
  cantidad: number
  motivo: string
  solicitado_por: string
  created_at: string
}

export type AjusteResultado = { ok: true } | { ok: false; error: string }
