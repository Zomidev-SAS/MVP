import { PUNTAJE_CALIDAD, promedio, type Calidad } from '@/lib/proveedores/desempeno'

export interface CandidatoComparable {
  precio: number | null
  tiempo_entrega_dias: number | null
  calidad: Calidad | null
}

export interface PuntajeCandidato {
  precio: number | null
  tiempo: number | null
  calidad: number | null
  global: number | null
}

export interface Comparacion {
  /** El mejor valor de cada criterio entre los candidatos (null si ninguno lo tiene). */
  mejores: { precio: number | null; tiempo: number | null; calidad: number | null }
  puntajes: PuntajeCandidato[]
  /** Índice del candidato con mejor puntaje global; en empate, el de menor precio. */
  recomendado: number | null
}

const redondear = (n: number) => Math.round(n * 10) / 10

/** Menor es mejor: el mejor vale 100 y los demás en proporción (mejor / valor × 100). */
function puntajeMenorEsMejor(valor: number | null, mejor: number | null): number | null {
  if (valor == null || mejor == null) return null
  if (valor === 0) return 100
  return redondear((mejor / valor) * 100)
}

export function compararCandidatos(candidatos: CandidatoComparable[]): Comparacion {
  const precios = candidatos.map((c) => c.precio).filter((v): v is number => v != null)
  const tiempos = candidatos.map((c) => c.tiempo_entrega_dias).filter((v): v is number => v != null)
  const calidades = candidatos
    .map((c) => (c.calidad ? PUNTAJE_CALIDAD[c.calidad] : null))
    .filter((v): v is number => v != null)

  const mejores = {
    precio: precios.length ? Math.min(...precios) : null,
    tiempo: tiempos.length ? Math.min(...tiempos) : null,
    calidad: calidades.length ? Math.max(...calidades) : null,
  }

  const puntajes = candidatos.map((c) => {
    const precio = puntajeMenorEsMejor(c.precio, mejores.precio)
    const tiempo = puntajeMenorEsMejor(c.tiempo_entrega_dias, mejores.tiempo)
    const calidad = c.calidad ? PUNTAJE_CALIDAD[c.calidad] : null
    return { precio, tiempo, calidad, global: promedio([precio, tiempo, calidad]) }
  })

  let recomendado: number | null = null
  puntajes.forEach((p, i) => {
    if (p.global == null) return
    if (recomendado == null) {
      recomendado = i
      return
    }
    const actual = puntajes[recomendado].global ?? -1
    const masBarato =
      p.global === actual &&
      (candidatos[i].precio ?? Infinity) < (candidatos[recomendado].precio ?? Infinity)
    if (p.global > actual || masBarato) recomendado = i
  })

  return { mejores, puntajes, recomendado }
}

/** Calidad que corresponde a un índice 0–100 (para precargar un proveedor con historial). */
export function calidadDeIndice(indice: number | null): Calidad | null {
  if (indice == null) return null
  if (indice >= 75) return 'bien'
  if (indice >= 25) return 'regular'
  return 'mal'
}
