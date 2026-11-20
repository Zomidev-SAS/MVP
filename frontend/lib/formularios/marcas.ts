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
  'JAC',
  'JOYLONG',
] as const

function clave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[\s-]+/g, '')
}

const MARCA_POR_CLAVE = new Map<string, string>(MARCAS_VEHICULO.map((m) => [clave(m), m]))

/**
 * Unifica nombres antiguos o escritos distinto con el nombre de la lista de la app:
 * "Mercedes", "MERCEDES" y "Mercedes-Benz" → MERCEDES BENZ; "Hyundai" → HYUNDAI; "Foton" → FOTÓN.
 */
export function normalizarMarca(marca: string | null | undefined): string | null {
  const original = (marca ?? '').trim()
  if (!original) return null
  const m = original.toUpperCase()
  if (m.startsWith('MERCEDES')) return 'MERCEDES BENZ'
  // "JAC SUNRAY" se usó como marca antes de separar el modelo (SUNRAY va en Tipo).
  if (m.startsWith('JAC')) return 'JAC'
  return MARCA_POR_CLAVE.get(clave(original)) ?? original
}
