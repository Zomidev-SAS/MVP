import type { FormularioListado } from '@/lib/types/formularios'
import { normalizarTextoBusqueda } from '@/lib/formularios/busqueda'

/**
 * Ubicaciones que la app móvil (pestaña Parqueadero) ofrece en lista.
 * La app guarda la elegida en data.bodegaParqueadero.
 */
export const UBICACIONES_PARQUEADERO = [
  'Principal',
  'Bodega Semi',
  'Bodegas Nuevas',
  'Parqueadero',
  'En línea',
] as const

/** Valor del filtro para registros de parqueadero que no coinciden con la lista (texto libre antiguo). */
export const UBICACION_SIN_CLASIFICAR = 'sin_clasificar'

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

/** Clasifica un texto por palabra clave; "cemi" se acepta por el nombre anterior de Bodega Semi. */
function clasificar(valor: string | null): string | null {
  const libre = normalizarTextoBusqueda(valor ?? '')
  if (!libre) return null
  if (libre.includes('semi') || libre.includes('cemi')) return 'Bodega Semi'
  if (libre.includes('nueva')) return 'Bodegas Nuevas'
  if (libre.includes('linea')) return 'En línea'
  if (libre.includes('principal')) return 'Principal'
  if (libre.includes('parqueadero')) return 'Parqueadero'
  return null
}

/**
 * Ubicación de la lista para un formulario de parqueadero, o null si no aplica.
 * Los registros anteriores a la lista (texto libre) se clasifican por palabras clave.
 */
export function ubicacionParqueaderoDe(fila: FormularioListado): string | null {
  return (
    clasificar(texto(fila.rawData.bodegaParqueadero)) ??
    clasificar(texto(fila.rawData.ubicacionParqueadero))
  )
}

/** Texto completo de la ubicación (incluye el detalle), para mostrar en la tabla. */
export function textoUbicacionParqueadero(fila: FormularioListado): string | null {
  return texto(fila.rawData.ubicacionParqueadero) ?? ubicacionParqueaderoDe(fila)
}

export function esFormularioParqueadero(fila: FormularioListado): boolean {
  const tipo = normalizarTextoBusqueda(
    fila.tipo ?? texto(fila.rawData.tipoFormulario) ?? texto(fila.dbColumns.tipo_formulario) ?? ''
  )
  return tipo.includes('ubicacion') || tipo.includes('parqueadero')
}

export function coincideUbicacionFiltro(fila: FormularioListado, filtro: string): boolean {
  if (!filtro || filtro === 'todas') return true
  if (!esFormularioParqueadero(fila)) return false
  const ubicacion = ubicacionParqueaderoDe(fila)
  if (filtro === UBICACION_SIN_CLASIFICAR) return ubicacion === null
  return ubicacion === filtro
}
