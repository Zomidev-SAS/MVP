import { z } from 'zod'

export const crearEventoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  titulo: z.string().trim().min(1, 'El título es requerido'),
  nota: z.string().trim().optional(),
})

export type CrearEventoInput = z.infer<typeof crearEventoSchema>

export interface CalendarEvento {
  id: number
  fecha: string
  titulo: string
  nota: string | null
}

export type EventoResultado = { ok: true } | { ok: false; error: string }
