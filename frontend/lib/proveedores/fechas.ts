const DIA_MS = 86_400_000
const ZONA_BOGOTA = 'America/Bogota'

/** Días entre la fecha prometida y la real. Negativo = llegó antes (igual que el Excel de control). */
export function diferenciaEnDias(prometida: string | null, real: string | null): number | null {
  if (!prometida || !real) return null
  const a = Date.parse(`${prometida}T00:00:00Z`)
  const b = Date.parse(`${real}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / DIA_MS)
}

/** Fecha (aaaa-mm-dd, hora de Bogotá) de un timestamp de la base. */
export function fechaDeTimestamp(timestamp: string | null | undefined): string | null {
  if (!timestamp) return null
  const fecha = new Date(timestamp)
  if (Number.isNaN(fecha.getTime())) return null
  return fecha.toLocaleDateString('en-CA', { timeZone: ZONA_BOGOTA })
}

/** "7 jul 2025" a partir de aaaa-mm-dd, sin corrimientos por zona horaria. */
export function formatearFechaCorta(fecha: string | null | undefined): string | null {
  if (!fecha) return null
  const [anio, mes, dia] = fecha.split('-').map(Number)
  if (!anio || !mes || !dia) return null
  return new Date(Date.UTC(anio, mes - 1, dia, 12)).toLocaleDateString('es-CO', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
