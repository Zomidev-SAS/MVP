import { diferenciaEnDias } from '@/lib/proveedores/fechas'

export const CALIDADES = ['bien', 'regular', 'mal'] as const
export type Calidad = (typeof CALIDADES)[number]

export const PUNTAJE_CALIDAD: Record<Calidad, number> = { bien: 100, regular: 50, mal: 0 }
export const ETIQUETA_CALIDAD: Record<Calidad, string> = { bien: 'Bien', regular: 'Regular', mal: 'Mal' }

export interface PesosDesempeno {
  calidad: number
  devoluciones: number
  cantidad: number
  tiempo: number
}

export interface ConfigDesempeno {
  umbral: number
  pesos: PesosDesempeno
  penalizacionDia: number
  penalizacionDevolucion: number
}

export const CONFIG_DESEMPENO_DEFAULT: ConfigDesempeno = {
  umbral: 85,
  pesos: { calidad: 25, devoluciones: 25, cantidad: 25, tiempo: 25 },
  penalizacionDia: 5,
  penalizacionDevolucion: 25,
}

export interface EntradaDesempeno {
  calidad: Calidad | null
  devoluciones: number
  cantidadPedida: number | null
  cantidadRecibida: number | null
  /** aaaa-mm-dd */
  fechaPrometida: string | null
  /** aaaa-mm-dd */
  fechaReal: string | null
}

export interface PuntajesDesempeno {
  calidad: number | null
  devoluciones: number
  cantidad: number | null
  tiempo: number | null
  diferenciaDias: number | null
  /** Promedio ponderado de las divisiones disponibles; null si ninguna aplica. */
  global: number | null
}

const acotar = (n: number) => Math.min(100, Math.max(0, n))

/**
 * Puntaje 0–100 de cada división y el global. Una división sin datos (calidad sin evaluar,
 * sin cantidades, sin fechas) no cuenta y los pesos se reparten entre las demás.
 */
export function calcularPuntajes(e: EntradaDesempeno, c: ConfigDesempeno): PuntajesDesempeno {
  const diferenciaDias = diferenciaEnDias(e.fechaPrometida, e.fechaReal)
  const calidad = e.calidad ? PUNTAJE_CALIDAD[e.calidad] : null
  const devoluciones = acotar(100 - c.penalizacionDevolucion * e.devoluciones)
  const cantidad =
    e.cantidadPedida != null && e.cantidadPedida > 0 && e.cantidadRecibida != null
      ? acotar((e.cantidadRecibida / e.cantidadPedida) * 100)
      : null
  const tiempo =
    diferenciaDias == null ? null : acotar(100 - c.penalizacionDia * Math.max(0, diferenciaDias))

  const partes: Array<[number | null, number]> = [
    [calidad, c.pesos.calidad],
    [devoluciones, c.pesos.devoluciones],
    [cantidad, c.pesos.cantidad],
    [tiempo, c.pesos.tiempo],
  ]
  let suma = 0
  let pesoTotal = 0
  for (const [puntaje, peso] of partes) {
    if (puntaje == null || peso <= 0) continue
    suma += puntaje * peso
    pesoTotal += peso
  }
  const global = pesoTotal > 0 ? Math.round((suma / pesoTotal) * 10) / 10 : null

  return { calidad, devoluciones, cantidad, tiempo, diferenciaDias, global }
}

export function promedio(valores: Array<number | null>): number | null {
  const utiles = valores.filter((v): v is number => v != null)
  if (utiles.length === 0) return null
  return Math.round((utiles.reduce((s, v) => s + v, 0) / utiles.length) * 10) / 10
}
