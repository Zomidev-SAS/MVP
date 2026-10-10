import { datosGeneralesDe, valorDbColumna } from '@/lib/formularios/db-columns'
import { parsearFecha } from '@/lib/formularios/fechas'
import type { FormularioListado } from '@/lib/types/formularios'

export function ordenarFormulariosRecientes(filas: FormularioListado[]): FormularioListado[] {
  return [...filas].sort((a, b) => timestampOrden(b) - timestampOrden(a))
}

function timestampOrden(fila: FormularioListado): number {
  const dg = datosGeneralesDe(fila.rawData)
  const candidatos = [
    fila.created_at,
    valorDbTexto(fila.dbColumns.saved_at),
    valorDbColumna(fila.dbColumns, 'fecha_salida'),
    valorDbColumna(fila.dbColumns, 'fecha_ingreso'),
    texto(dg?.fechaSalida),
    texto(dg?.fechaIngreso),
    valorDbColumna(fila.dbColumns, 'dg_fecha'),
  ]

  for (const candidato of candidatos) {
    const ts = parsearFecha(candidato)?.getTime()
    if (ts && !Number.isNaN(ts)) return ts
  }

  return 0
}

function texto(valor: unknown): string | null {
  if (typeof valor === 'string' && valor.trim()) return valor.trim()
  return null
}

function valorDbTexto(valor: unknown): string | null {
  if (typeof valor === 'string' && valor.trim()) return valor.trim()
  return null
}
