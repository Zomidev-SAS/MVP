/**
 * Las subcarpetas son prefijos dentro del contenedor ("Modelo B/Planos/x.pdf").
 * Una carpeta vacía existe gracias a un archivo marcador de 0 bytes.
 */
export const MARCADOR = '.carpeta'

const MAX_SEGMENTO = 100
const MAX_PROFUNDIDAD = 6

/** Valida un nombre de archivo o de carpeta (un solo tramo de la ruta). */
export function limpiarSegmento(original: string): string | null {
  const limpio = original.replace(/[\u0000-\u001f]/g, '').trim()
  if (!limpio || limpio === '.' || limpio === '..' || limpio === MARCADOR) return null
  if (limpio.length > MAX_SEGMENTO || /[\\/]/.test(limpio)) return null
  return limpio
}

/** Devuelve la ruta sin barras sobrantes, o null si algún tramo no es válido. '' es la raíz. */
export function normalizarRuta(ruta: string): string | null {
  const tramos = ruta.split('/').filter((t) => t.length > 0)
  if (tramos.length > MAX_PROFUNDIDAD) return null
  const validos: string[] = []
  for (const tramo of tramos) {
    const limpio = limpiarSegmento(tramo)
    if (!limpio || limpio !== tramo) return null
    validos.push(limpio)
  }
  return validos.join('/')
}

export function unirRuta(ruta: string, nombre: string): string {
  return ruta ? `${ruta}/${nombre}` : nombre
}

export function nombreDe(ruta: string): string {
  return ruta.split('/').pop() ?? ruta
}

export function padreDe(ruta: string): string {
  const i = ruta.lastIndexOf('/')
  return i === -1 ? '' : ruta.slice(0, i)
}

export function profundidad(ruta: string): number {
  return ruta ? ruta.split('/').length : 0
}

export { MAX_PROFUNDIDAD }
