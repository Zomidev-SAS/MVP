export function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-CO').format(value)
}

export function formatCompactNumero(value: number): string {
  return new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value
  )
}

export function truncarEtiqueta(texto: string, maxLength = 14): string {
  return texto.length > maxLength ? `${texto.slice(0, maxLength - 1)}…` : texto
}

/**
 * Fecha + hora en es-CO. El ICU de Node (SSR) y el de Chrome (hidratación)
 * no usan el mismo carácter de espacio antes de "a. m."/"p. m." (uno usa
 * espacio normal, el otro NBSP) — visualmente idéntico pero React lo
 * detecta como mismatch de hidratación en cada fecha de la app. Se
 * normaliza todo espacio a uno normal para que servidor y cliente
 * produzcan exactamente el mismo string.
 */
export function formatFechaHora(value: string | number | Date): string {
  return new Date(value).toLocaleString('es-CO').replace(/\s/g, ' ')
}
