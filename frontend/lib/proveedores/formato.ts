export type NivelCumplimiento = 'bueno' | 'regular' | 'bajo'

export const UMBRAL_APROBACION_DEFAULT = 85

/** Bueno desde el umbral; regular hasta 15 puntos por debajo; bajo si baja de ahí. */
export function nivelCumplimiento(
  porcentaje: number,
  umbral: number = UMBRAL_APROBACION_DEFAULT
): NivelCumplimiento {
  if (porcentaje >= umbral) return 'bueno'
  if (porcentaje >= umbral - 15) return 'regular'
  return 'bajo'
}

/** Color del punto de estado; solo el dato lleva color, el resto de la fila queda neutro. */
export const CLASE_PUNTO_NIVEL: Record<NivelCumplimiento, string> = {
  bueno: 'bg-[var(--success)]',
  regular: 'bg-[var(--warning)]',
  bajo: 'bg-destructive',
}

export function formatearPorcentaje(valor: number): string {
  return `${valor.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

export function formatearEntero(valor: number): string {
  return valor.toLocaleString('es-CO')
}
