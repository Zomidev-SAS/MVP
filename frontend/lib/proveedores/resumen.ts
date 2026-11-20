import { promedio } from '@/lib/proveedores/desempeno'
import { seCalifica, type FilaHistorial } from '@/lib/proveedores/historial'

export interface ResumenDesempeno {
  total: number
  calificadas: number
  /** Promedio del cumplimiento de las órdenes calificadas. */
  porcentaje: number | null
  promedios: {
    calidad: number | null
    devoluciones: number | null
    cantidad: number | null
    tiempo: number | null
  }
  conRetraso: number
  devoluciones: number
  /** Días de retraso promedio entre las entregas que llegaron tarde. */
  diasRetrasoPromedio: number | null
}

/** Cifras del cuadro de un proveedor, sobre las filas que se le pasen (todas o las de un año). */
export function resumirDesempeno(filas: FilaHistorial[]): ResumenDesempeno {
  const calificadas = filas.filter((f) => seCalifica(f.estado) && f.puntajes?.global != null)
  const retrasos = filas
    .map((f) => f.diferencia_dias)
    .filter((d): d is number => d != null && d > 0)

  return {
    total: filas.length,
    calificadas: calificadas.length,
    porcentaje: promedio(calificadas.map((f) => f.puntajes?.global ?? null)),
    promedios: {
      calidad: promedio(calificadas.map((f) => f.puntajes?.calidad ?? null)),
      devoluciones: promedio(calificadas.map((f) => f.puntajes?.devoluciones ?? null)),
      cantidad: promedio(calificadas.map((f) => f.puntajes?.cantidad ?? null)),
      tiempo: promedio(calificadas.map((f) => f.puntajes?.tiempo ?? null)),
    },
    conRetraso: retrasos.length,
    devoluciones: filas.reduce((total, f) => total + f.devoluciones, 0),
    diasRetrasoPromedio: promedio(retrasos),
  }
}
