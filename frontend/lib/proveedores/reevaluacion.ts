import type { ConfigDesempeno } from '@/lib/proveedores/desempeno'
import type { FilaHistorial } from '@/lib/proveedores/historial'
import { resumirDesempeno, type ResumenDesempeno } from '@/lib/proveedores/resumen'

/** Fecha con la que una orden cuenta para un año: la entrega real; si no hay, la fecha de la orden. */
export function fechaReferencia(fila: FilaHistorial): string | null {
  return fila.fecha_entrega_real ?? fila.fecha_oc
}

export function filasDelAnio(filas: FilaHistorial[], anio: number): FilaHistorial[] {
  const prefijo = `${anio}-`
  return filas.filter((fila) => fechaReferencia(fila)?.startsWith(prefijo))
}

/** Años con órdenes, del más reciente al más antiguo, siempre incluyendo el año en curso. */
export function aniosDisponibles(filas: FilaHistorial[], anioActual: number): number[] {
  const anios = new Set<number>([anioActual])
  for (const fila of filas) {
    const fecha = fechaReferencia(fila)
    if (fecha) anios.add(Number(fecha.slice(0, 4)))
  }
  return [...anios].sort((a, b) => b - a)
}

export interface ResumenReevaluacion extends ResumenDesempeno {
  anio: number
  umbral: number
  /** null cuando no hay órdenes calificadas en el año. */
  superaUmbral: boolean | null
}

export function calcularReevaluacion(
  filas: FilaHistorial[],
  anio: number,
  config: ConfigDesempeno
): ResumenReevaluacion {
  const resumen = resumirDesempeno(filasDelAnio(filas, anio))
  return {
    ...resumen,
    anio,
    umbral: config.umbral,
    superaUmbral: resumen.porcentaje == null ? null : resumen.porcentaje >= config.umbral,
  }
}

/** El motivo es obligatorio si no se continúa o si el proveedor queda por debajo del umbral. */
export function motivoObligatorio(
  resultado: 'continuar' | 'no_continuar',
  porcentaje: number | null,
  umbral: number
): boolean {
  return resultado === 'no_continuar' || (porcentaje != null && porcentaje < umbral)
}
