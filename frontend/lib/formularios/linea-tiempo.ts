import { datosGeneralesDe, valorDbColumna } from '@/lib/formularios/db-columns'
import { normalizarTextoBusqueda } from '@/lib/formularios/busqueda'
import { vistaFormulario, type FormularioListado } from '@/lib/types/formularios'
import { esFormularioParqueadero, textoUbicacionParqueadero } from '@/lib/formularios/ubicacion-parqueadero'

export interface EventoLineaTiempo {
  id: string
  tipoLabel: string
  fecha: string | null
  chasis: string
  marca: string | null
  ciudad: string | null
  /** Dónde quedó el vehículo (solo en eventos de Parqueadero). */
  ubicacion?: string | null
}

export interface VehiculoSugerencia {
  chasis: string
  marca: string | null
  ciudad: string | null
  /** ISO — último formulario asociado al chasis (para ordenar recientes). */
  ultimo_ingreso?: string | null
  /** Etapa más avanzada alcanzada por el vehículo, o null si no hay formularios reconocidos. */
  estadoActual?: EtapaVehiculoNombre | null
  /** Dónde está ahora, si su etapa actual es Parqueadero (ubicación más reciente). */
  ubicacion?: string | null
}

/** Etapas fijas del proceso de un vehículo, en el orden en que ocurren. */
export const ETAPAS_VEHICULO = ['Entrada', 'En proceso', 'Parqueadero', 'Salida'] as const
export type EtapaVehiculoNombre = (typeof ETAPAS_VEHICULO)[number]

export type IdEtapaVehiculo =
  | 'entrada'
  | 'parqueadero-antes'
  | 'proceso'
  | 'parqueadero-despues'
  | 'salida'

export interface EtapaVehiculo {
  /** Único por columna: Parqueadero puede aparecer antes y después de En proceso. */
  id: IdEtapaVehiculo
  etapa: EtapaVehiculoNombre
  completada: boolean
  /** El más reciente de la etapa (compatibilidad). */
  evento: EventoLineaTiempo | null
  /** Todos los registros de la etapa, del más antiguo al más reciente. */
  eventos: EventoLineaTiempo[]
  /** Aclaración cuando Parqueadero se repite ("antes del proceso" / "después del proceso"). */
  nota?: string
}

/** Un proceso registrado por el taller; solo importa cuándo empezó. */
export interface InicioProceso {
  creadoEn: string | null
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
        ubicacion: esFormularioParqueadero(fila) ? textoUbicacionParqueadero(fila) : null,
      }
    })
    .sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0
      if (!a.fecha) return -1
      if (!b.fecha) return 1
      return a.fecha.localeCompare(b.fecha)
    })
}

function milisegundos(fecha: string | null | undefined): number | null {
  if (!fecha) return null
  const t = new Date(fecha).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * Mapea eventos reales a las etapas del proceso, siguiendo el orden de las fechas.
 * "En proceso" no tiene formulario propio: se marca completada apenas hay Entrada.
 * Parqueadero puede ocurrir ANTES de que empiece el proceso (el vehículo llega y espera)
 * y DESPUÉS (terminó y espera la salida): los registros anteriores al primer proceso van
 * en una columna antes de "En proceso" y el resto en la columna posterior, así se ve si
 * apenas llegó o ya salió. Sin procesos registrados: antes del proceso si aún no hay Salida
 * (el vehículo acaba de llegar y espera), después si ya salió.
 * "Parqueadero" (después) también se marca completada si ya hay Salida.
 */
export function construirEtapasVehiculo(
  eventos: EventoLineaTiempo[],
  procesos: InicioProceso[] = []
): EtapaVehiculo[] {
  const deTipo = (nombre: EtapaVehiculoNombre) => eventos.filter((e) => e.tipoLabel === nombre)
  const ultimo = (lista: EventoLineaTiempo[]) => (lista.length > 0 ? lista[lista.length - 1] : null)

  const entradas = deTipo('Entrada')
  const salidas = deTipo('Salida')
  const parqueaderos = deTipo('Parqueadero')

  const inicios = procesos.map((p) => milisegundos(p.creadoEn)).filter((t): t is number => t !== null)
  const inicioProceso = inicios.length > 0 ? Math.min(...inicios) : null

  const antes: EventoLineaTiempo[] = []
  const despues: EventoLineaTiempo[] = []
  for (const evento of parqueaderos) {
    const t = milisegundos(evento.fecha)
    if (inicioProceso !== null) {
      if (t !== null && t < inicioProceso) antes.push(evento)
      else despues.push(evento)
    } else if (salidas.length === 0) {
      // Sin procesos ni salida: el vehículo apenas llegó y espera en parqueadero.
      antes.push(evento)
    } else {
      despues.push(evento)
    }
  }

  const etapas: EtapaVehiculo[] = [
    {
      id: 'entrada',
      etapa: 'Entrada',
      completada: entradas.length > 0,
      evento: ultimo(entradas),
      eventos: entradas,
    },
  ]
  if (antes.length > 0) {
    etapas.push({
      id: 'parqueadero-antes',
      etapa: 'Parqueadero',
      completada: true,
      evento: ultimo(antes),
      eventos: antes,
      nota: 'antes del proceso',
    })
  }
  etapas.push({ id: 'proceso', etapa: 'En proceso', completada: entradas.length > 0, evento: null, eventos: [] })
  etapas.push({
    id: 'parqueadero-despues',
    etapa: 'Parqueadero',
    completada: despues.length > 0 || salidas.length > 0,
    evento: ultimo(despues),
    eventos: despues,
    nota: antes.length > 0 ? 'después del proceso' : undefined,
  })
  etapas.push({
    id: 'salida',
    etapa: 'Salida',
    completada: salidas.length > 0,
    evento: ultimo(salidas),
    eventos: salidas,
  })
  return etapas
}

/** Etapa más avanzada alcanzada dado el conjunto de tipoLabel vistos para un chasis. */
function estadoActualDe(tiposVistos: Set<string>): EtapaVehiculoNombre | null {
  if (tiposVistos.has('Salida')) return 'Salida'
  if (tiposVistos.has('Parqueadero')) return 'Parqueadero'
  if (tiposVistos.has('Entrada')) return 'En proceso'
  return null
}

function indiceVehiculos(filas: FormularioListado[]): Map<string, VehiculoSugerencia> {
  const map = new Map<string, VehiculoSugerencia>()
  const tiposPorChasis = new Map<string, Set<string>>()
  // Ubicación de parqueadero más reciente por chasis (por fecha de guardado).
  const ubicaciones = new Map<string, { guardado: string; texto: string }>()

  for (const fila of filas) {
    const vista = vistaFormulario(fila)
    if (vista.chasis === '—') continue

    if (esFormularioParqueadero(fila)) {
      const texto = textoUbicacionParqueadero(fila)
      const guardado = fila.created_at ?? ''
      const previa = ubicaciones.get(vista.chasis)
      if (texto && (!previa || guardado > previa.guardado)) {
        ubicaciones.set(vista.chasis, { guardado, texto })
      }
    }

    const tipos = tiposPorChasis.get(vista.chasis) ?? new Set<string>()
    tipos.add(vista.tipoLabel)
    tiposPorChasis.set(vista.chasis, tipos)

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

  for (const [chasis, vehiculo] of map) {
    vehiculo.estadoActual = estadoActualDe(tiposPorChasis.get(chasis) ?? new Set())
    vehiculo.ubicacion =
      vehiculo.estadoActual === 'Parqueadero' ? (ubicaciones.get(chasis)?.texto ?? null) : null
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
        normalizarTextoBusqueda(v.marca ?? '').includes(q) ||
        normalizarTextoBusqueda(v.ciudad ?? '').includes(q)
    )
    .slice(0, limite)
}
