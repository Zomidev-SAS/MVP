import { datosGeneralesDe, valorDbColumna } from '@/lib/formularios/db-columns'
import { normalizarTextoBusqueda } from '@/lib/formularios/busqueda'
import { vistaFormulario, type FormularioListado } from '@/lib/types/formularios'

export interface EventoLineaTiempo {
  id: string
  tipoLabel: string
  fecha: string | null
  chasis: string
  marca: string | null
  ciudad: string | null
}

export interface VehiculoSugerencia {
  chasis: string
  marca: string | null
  ciudad: string | null
}

function ciudadDe(fila: FormularioListado): string | null {
  const dg = datosGeneralesDe(fila.rawData)
  return (
    valorDbColumna(fila.dbColumns, 'dg_ciudad') ??
    (typeof dg?.ciudad === 'string' && dg.ciudad.trim() ? dg.ciudad.trim() : null)
  )
}

function fechaEvento(vista: ReturnType<typeof vistaFormulario>): string | null {
  return vista.fechaIngreso ?? vista.fechaSalida
}

/** Eventos de un vehículo (ya filtrado por chasis), ordenados cronológicamente ascendente. */
export function construirEventosLineaTiempo(filas: FormularioListado[]): EventoLineaTiempo[] {
  return filas
    .map((fila) => {
      const vista = vistaFormulario(fila)
      return {
        id: fila.id,
        tipoLabel: vista.tipoLabel,
        fecha: fechaEvento(vista),
        chasis: vista.chasis,
        marca: vista.marca,
        ciudad: ciudadDe(fila),
      }
    })
    .sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0
      if (!a.fecha) return -1
      if (!b.fecha) return 1
      return a.fecha.localeCompare(b.fecha)
    })
}

/** Sugerencias de vehículos (chasis únicos) que hacen match con el término de búsqueda. */
export function extraerSugerenciasVehiculo(
  filas: FormularioListado[],
  termino: string,
  limite = 8
): VehiculoSugerencia[] {
  const q = normalizarTextoBusqueda(termino)
  if (!q) return []

  const vistas = new Map<string, VehiculoSugerencia>()

  for (const fila of filas) {
    const vista = vistaFormulario(fila)
    if (vista.chasis === '—') continue
    if (!normalizarTextoBusqueda(vista.chasis).includes(q)) continue
    if (vistas.has(vista.chasis)) continue

    vistas.set(vista.chasis, {
      chasis: vista.chasis,
      marca: vista.marca,
      ciudad: ciudadDe(fila),
    })

    if (vistas.size >= limite) break
  }

  return Array.from(vistas.values())
}
