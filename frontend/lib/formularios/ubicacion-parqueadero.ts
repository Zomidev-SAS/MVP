import type { FormularioListado } from '@/lib/types/formularios'
import { normalizarTextoBusqueda } from '@/lib/formularios/busqueda'

/**
 * Ubicaciones que la app móvil (pestaña Parqueadero) ofrece en lista.
 * La app guarda la elegida en data.bodegaParqueadero.
 */
export const UBICACIONES_PARQUEADERO = ['Principal', 'Bodega Cemi', 'Bodegas Nuevas'] as const

/** Valor del filtro para registros de parqueadero que no coinciden con la lista (texto libre antiguo). */
export const UBICACION_SIN_CLASIFICAR = 'sin_clasificar'

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

/**
 * Ubicación de la lista para un formulario de parqueadero, o null si no aplica.
 * Los registros anteriores a la lista (texto libre) se clasifican por palabras clave.
 */
export function ubicacionParqueaderoDe(fila: FormularioListado): string | null {
  const guardada = texto(fila.rawData.bodegaParqueadero)
  const coincide = UBICACIONES_PARQUEADERO.find((u) => u === guardada)
  if (coincide) return coincide

  const libre = normalizarTextoBusqueda(texto(fila.rawData.ubicacionParqueadero) ?? '')
  if (!libre) return null
  if (libre.includes('cemi')) return 'Bodega Cemi'
  if (libre.includes('nueva')) return 'Bodegas Nuevas'
  if (libre.includes('principal')) return 'Principal'
  return null
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
