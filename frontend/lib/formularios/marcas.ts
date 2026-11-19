/**
 * Marcas que ofrece la app móvil (vehiculosapp, src/utils/vinDecoder.ts).
 * Se muestran siempre en el filtro de Formularios, aunque todavía no haya registros.
 */
export const MARCAS_VEHICULO = [
  'DFSK',
  'FOTÓN',
  'MERCEDES BENZ',
  'HYUNDAI',
  'RENAULT',
  'FORD',
  'JAC SUNRAY',
  'JOYLONG',
] as const

/** Unifica nombres antiguos o escritos distinto (p. ej. "MERCEDES" → "MERCEDES BENZ"). */
export function normalizarMarca(marca: string | null | undefined): string | null {
  const original = (marca ?? '').trim()
  if (!original) return null
  const m = original.toUpperCase()
  if (m.startsWith('MERCEDES')) return 'MERCEDES BENZ'
  if (m === 'FOTON') return 'FOTÓN'
  if (m.replace(/\s+/g, '') === 'JOYLONG') return 'JOYLONG'
  if (m === 'JAC' || m === 'JAC SUN RAY') return 'JAC SUNRAY'
  return original
}
