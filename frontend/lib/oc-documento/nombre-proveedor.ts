// Sufijos legales que, solos, no son un nombre de proveedor ("LTDA", "S.A.S.", "O LTDA").
const SUFIJOS_LEGALES = new Set([
  'LTDA', 'LIMITADA', 'SAS', 'SA', 'SCA', 'SC', 'EU', 'CIA', 'CIA.', 'Y', 'O', 'E', 'U', 'DE', 'Y CIA',
])

/**
 * true si el nombre guardado del proveedor quedó cortado: no tiene ninguna palabra
 * propia, solo sufijos legales o letras sueltas. Un nombre corto pero completo
 * ("CASTAÑO", "SIGS SAS") NO cuenta como incompleto.
 */
export function nombreProveedorIncompleto(nombre: string | null | undefined): boolean {
  const base = (nombre ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[.,;:()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!base) return false

  const propias = base.split(' ').filter((palabra) => !SUFIJOS_LEGALES.has(palabra))
  return propias.join('').length < 4
}
