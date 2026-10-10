import { coincideBusquedaFormulario, coincideFiltroLista } from '@/lib/formularios/busqueda'
import { extraerDbColumns } from '@/lib/formularios/db-columns'
import { aplanarFilaFormulario } from '@/lib/formularios/flatten'
import { ordenarFormulariosRecientes } from '@/lib/formularios/orden'
import type { FormularioListado, FormulariosFiltros } from '@/lib/types/formularios'
import { extraerFechaIngreso, extraerFechaSalida } from '@/lib/types/formularios'

export const TIPO_DB_MATCH: Record<Exclude<FormulariosFiltros['tipo'], 'todos'>, string[]> = {
  entrada: ['entrada', 'entradas', 'ingreso', 'in'],
  salida: ['salida', 'salidas', 'salida_vin', 'egreso', 'out'],
  parqueadero: ['parqueadero', 'parking'],
}

export function normalizarFormulario(row: Record<string, unknown>): FormularioListado {
  const id = String(row.id ?? row.uuid ?? row.formulario_id ?? cryptoRandomId())
  const dbColumns = extraerDbColumns(row)
  const rawData = extraerRawData(row)
  const data = aplanarFilaFormulario(row)
  const tipo =
    pickPorClaves(dbColumns, ['tipo_formulario', 'tipo']) ??
    extraerTipo(rawData) ??
    extraerTipo(data) ??
    inferirTipo(rawData, dbColumns)
  const created_at =
    valorAString(row.created_at) ??
    valorAString(dbColumns.saved_at) ??
    valorAString(dbColumns.created_at)
  return { id, tipo, data, rawData, dbColumns, created_at }
}

export function normalizarFormularios(data: unknown): FormularioListado[] {
  if (!Array.isArray(data)) return []
  return data.map((row) => normalizarFormulario(row as Record<string, unknown>))
}

export function filtrarYOrdenarFormularios(
  filas: FormularioListado[],
  filtros: FormulariosFiltros
): FormularioListado[] {
  return ordenarFormulariosRecientes(
    filas
      .filter((fila) => coincideTipoFiltro(fila, filtros.tipo))
      .filter((fila) => coincideBusquedaFormulario(fila, filtros.busqueda))
      .filter((fila) => coincideFiltroLista(fila, filtros.filtros))
  )
}

function extraerTipo(data: Record<string, unknown>): string | null {
  return pickPorClaves(data, [
    'tipoFormulario',
    'tipo',
    'type',
    'tipo_formulario',
    'form_type',
    'movimiento',
    'operacion',
    'accion',
    'categoria',
  ])
}

function extraerRawData(row: Record<string, unknown>): Record<string, unknown> {
  const dataCol = row.data
  if (dataCol && typeof dataCol === 'object' && !Array.isArray(dataCol)) {
    return dataCol as Record<string, unknown>
  }
  return {}
}

function inferirTipo(
  rawData: Record<string, unknown>,
  dbColumns: Record<string, unknown>
): string | null {
  const dg =
    rawData.datosGenerales && typeof rawData.datosGenerales === 'object'
      ? (rawData.datosGenerales as Record<string, unknown>)
      : null

  const fechaSalida =
    valorAString(dbColumns.fecha_salida) ??
    valorAString(dg?.fechaSalida) ??
    extraerFechaSalida(rawData as Record<string, unknown>)
  const fechaIngreso =
    valorAString(dbColumns.fecha_ingreso) ??
    valorAString(dbColumns.dg_fechaingreso) ??
    valorAString(dg?.fechaIngreso) ??
    extraerFechaIngreso(rawData as Record<string, unknown>)

  if (fechaSalida && !fechaIngreso) return 'salida'
  if (fechaIngreso && !fechaSalida) return 'entrada'
  return null
}

export function coincideTipoFiltro(
  fila: FormularioListado,
  filtro: FormulariosFiltros['tipo']
): boolean {
  if (filtro === 'todos') return true

  const valores = TIPO_DB_MATCH[filtro]
  const candidatos = [
    fila.tipo,
    valorAString(fila.dbColumns.tipo_formulario),
    valorAString(fila.rawData.tipoFormulario),
  ]
    .filter((v): v is string => Boolean(v))
    .map((v) => v.toLowerCase())

  if (candidatos.length === 0) return false

  return candidatos.some((c) =>
    valores.some((v) => c === v || c.includes(v) || v.includes(c))
  )
}

/** @deprecated Usar coincideBusquedaFormulario */
export function coincideBusqueda(fila: FormularioListado, busqueda: string): boolean {
  return coincideBusquedaFormulario(fila, busqueda)
}

function pickPorClaves(data: Record<string, unknown>, claves: string[]): string | null {
  for (const clave of claves) {
    for (const [key, value] of Object.entries(data)) {
      const k = key.toLowerCase()
      if (k === clave.toLowerCase() || k.endsWith(`_${clave.toLowerCase()}`)) {
        const parsed = valorAString(value)
        if (parsed) return parsed
      }
    }
  }

  for (const clave of claves) {
    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase().includes(clave.toLowerCase())) {
        const parsed = valorAString(value)
        if (parsed) return parsed
      }
    }
  }

  return null
}

function valorAString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value)
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  return null
}

function cryptoRandomId(): string {
  return `row-${Math.random().toString(36).slice(2, 10)}`
}
