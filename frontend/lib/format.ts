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
