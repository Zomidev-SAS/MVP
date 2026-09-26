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
  /** ISO — último formulario asociado al chasis (para ordenar recientes). */
  ultimo_ingreso?: string | null
}

/** Etapas fijas del proceso de un vehículo, en el orden en que ocurren. */
export const ETAPAS_VEHICULO = ['Entrada', 'En proceso', 'Parqueadero', 'Salida'] as const
export type EtapaVehiculoNombre = (typeof ETAPAS_VEHICULO)[number]

export interface EtapaVehiculo {
  etapa: EtapaVehiculoNombre
  completada: boolean
  evento: EventoLineaTiempo | null
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

/**
 * Mapea eventos reales a las etapas fijas del proceso, marcando las que aún no ocurrieron.
 * "En proceso" no tiene formulario propio — se marca completada apenas hay Entrada,
 * representando que el vehículo ya está en gestión activa.
 * "Parqueadero" también se marca completada si ya hay Salida, aunque no tenga su propio
 * formulario — si el vehículo ya salió, necesariamente pasó (o se saltó) esa etapa.
 */
export function construirEtapasVehiculo(eventos: EventoLineaTiempo[]): EtapaVehiculo[] {
  function ultimoEventoDe(nombre: EtapaVehiculoNombre): EventoLineaTiempo | null {
    const coincidencias = eventos.filter((evento) => evento.tipoLabel === nombre)
    return coincidencias.length > 0 ? coincidencias[coincidencias.length - 1] : null
  }

  const eventoEntrada = ultimoEventoDe('Entrada')
  const eventoSalida = ultimoEventoDe('Salida')

  return ETAPAS_VEHICULO.map((etapa) => {
    if (etapa === 'En proceso') {
      return { etapa, completada: eventoEntrada !== null, evento: null }
    }
    const evento = ultimoEventoDe(etapa)
    if (etapa === 'Parqueadero') {
      return { etapa, completada: evento !== null || eventoSalida !== null, evento }
    }
    return { etapa, completada: evento !== null, evento }
  })
}

function indiceVehiculos(filas: FormularioListado[]): Map<string, VehiculoSugerencia> {
  const map = new Map<string, VehiculoSugerencia>()

  for (const fila of filas) {
    const vista = vistaFormulario(fila)
    if (vista.chasis === '—') continue

    const fecha = fechaEvento(vista)
    const existente = map.get(vista.chasis)
    if (!existente) {
      map.set(vista.chasis, {
        chasis: vista.chasis,
        marca: vista.marca,
        ciudad: ciudadDe(fila),
        ultimo_ingreso: fecha,
      })
      continue
    }

    if (fecha && (!existente.ultimo_ingreso || fecha > existente.ultimo_ingreso)) {
      map.set(vista.chasis, {
        chasis: vista.chasis,
        marca: vista.marca ?? existente.marca,
        ciudad: ciudadDe(fila) ?? existente.ciudad,
        ultimo_ingreso: fecha,
      })
    }
  }

  return map
}

/** Vehículos únicos ordenados del más reciente al más antiguo. */
export function listarVehiculosRecientes(
  filas: FormularioListado[],
  limite = 30
): VehiculoSugerencia[] {
  return Array.from(indiceVehiculos(filas).values())
    .sort((a, b) => {
      const fa = a.ultimo_ingreso ?? ''
      const fb = b.ultimo_ingreso ?? ''
      return fb.localeCompare(fa)
    })
    .slice(0, limite)
}

/** Sugerencias de vehículos (chasis únicos) que hacen match con el término de búsqueda. */
export function extraerSugerenciasVehiculo(
  filas: FormularioListado[],
  termino: string,
  limite = 8
): VehiculoSugerencia[] {
  const q = normalizarTextoBusqueda(termino)
  if (!q) return []

  return listarVehiculosRecientes(filas, filas.length)
    .filter(
      (v) =>
        normalizarTextoBusqueda(v.chasis).includes(q) ||
        normalizarTextoBusqueda(v.marca ?? '').includes(q)
    )
    .slice(0, limite)
}
