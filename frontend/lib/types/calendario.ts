import { z } from 'zod'

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

export const eventoSeccionSchema = z.object({
  id: z.number().optional(),
  titulo: z.string().trim().min(1, 'La sección necesita un título'),
  completada: z.boolean(),
})

export const guardarEventoSchema = z
  .object({
    fecha: fechaSchema,
    fecha_fin: fechaSchema.nullable(),
    titulo: z.string().trim().min(1, 'El título es requerido'),
    nota: z.string(),
    fechas_adicionales: z.array(fechaSchema),
    secciones: z.array(eventoSeccionSchema),
  })
  .superRefine((data, ctx) => {
    if (data.fecha_fin && data.fecha_fin < data.fecha) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La fecha final debe ser igual o posterior a la inicial',
        path: ['fecha_fin'],
      })
    }
  })

export type GuardarEventoInput = z.infer<typeof guardarEventoSchema>
export type EventoSeccionInput = z.infer<typeof eventoSeccionSchema>

/** @deprecated Usar guardarEventoSchema */
export const crearEventoSchema = guardarEventoSchema
/** @deprecated Usar GuardarEventoInput */
export type CrearEventoInput = GuardarEventoInput

export interface EventoSeccion {
  id: number
  titulo: string
  completada: boolean
  orden: number
}

export interface CalendarEvento {
  id: number
  fecha: string
  fecha_fin: string | null
  titulo: string
  nota: string | null
  secciones: EventoSeccion[]
  fechas_adicionales: string[]
}

export type EventoResultado = { ok: true } | { ok: false; error: string }

const DAY_MS = 24 * 60 * 60 * 1000

function parseFecha(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toFechaKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Todas las fechas en las que ocurre el evento (rango + adicionales). */
export function getFechasEvento(evento: CalendarEvento): string[] {
  const fechas = new Set<string>()

  if (evento.fecha_fin) {
    let cursor = parseFecha(evento.fecha)
    const fin = parseFecha(evento.fecha_fin)
    while (cursor <= fin) {
      fechas.add(toFechaKey(cursor))
      cursor = new Date(cursor.getTime() + DAY_MS)
    }
  } else {
    fechas.add(evento.fecha)
  }

  for (const extra of evento.fechas_adicionales) {
    fechas.add(extra)
  }

  return [...fechas].sort()
}

export function eventoOcurreEnFecha(evento: CalendarEvento, fecha: string): boolean {
  return getFechasEvento(evento).includes(fecha)
}

export function formatearRangoFechas(evento: CalendarEvento): string {
  if (evento.fecha_fin && evento.fecha_fin !== evento.fecha) {
    return `${evento.fecha} → ${evento.fecha_fin}`
  }
  const extras = evento.fechas_adicionales.length
  if (extras > 0) {
    return `${evento.fecha} (+${extras} fecha${extras === 1 ? '' : 's'})`
  }
  return evento.fecha
}
