import { datosGeneralesDe, valorDbColumna } from '@/lib/formularios/db-columns'
import { formatearFechaCompacta } from '@/lib/formularios/fechas'
import type { OpcionFiltro } from '@/lib/formularios/opciones-filtro'

export interface FormularioListado {
  id: string
  tipo: string | null
  data: Record<string, unknown>
  /** JSON original de la app (sin aplanar), para el detalle */
  rawData: Record<string, unknown>
  /** Columnas reales de la tabla formularios (sin data) */
  dbColumns: Record<string, unknown>
  created_at: string | null
}

export interface FormulariosFiltros {
  busqueda: string
  tipo: 'todos' | 'entrada' | 'salida' | 'parqueadero'
  /** Valor de la lista Filtros, ej. "marca:MERCEDES" o "todos" */
  filtros: string
}

export interface FormulariosPagina {
  filas: FormularioListado[]
  total: number
  totalDb: number
  opcionesFiltro: OpcionFiltro[]
  error?: string
}

export interface FormularioVista {
  tipo: string | null
  tipoLabel: string
  chasis: string
  marca: string | null
  fechaIngreso: string | null
  fechaSalida: string | null
}

export function esFormularioEntrada(tipo: string | null): boolean {
  if (!tipo) return false
  const t = tipo.toLowerCase()
  return t.includes('entrada') || t.includes('ingreso') || t === 'in'
}

export function esFormularioSalida(tipo: string | null): boolean {
  if (!tipo) return false
  const t = tipo.toLowerCase()
  return t.includes('salida') || t.includes('egreso') || t === 'out'
}

export function labelTipoFormulario(tipo: string | null): string {
  if (!tipo) return 'Sin tipo'
  if (esFormularioEntrada(tipo)) return 'Entrada'
  if (esFormularioSalida(tipo)) return 'Salida'
  if (tipo.toLowerCase().includes('parqueadero')) return 'Parqueadero'
  return tipo.charAt(0).toUpperCase() + tipo.slice(1)
}

export function extraerChasis(data: Record<string, unknown>): string {
  return pickPorPatron(data, ['chasis', 'vin', 'numero_vin', 'num_chasis']) ?? '—'
}

export function extraerFechaIngreso(data: Record<string, unknown>): string | null {
  return (
    combinarFechaHora(data, 'ingreso') ??
    pickFecha(data, ['fechaingreso', 'fecha_ingreso', 'horaingreso', 'hora_ingreso'])
  )
}

export function extraerFechaSalida(data: Record<string, unknown>): string | null {
  return (
    combinarFechaHora(data, 'salida') ??
    pickFecha(data, ['fechasalida', 'fecha_salida', 'horasalida', 'hora_salida'])
  )
}

function combinarFechaHora(data: Record<string, unknown>, tipo: 'ingreso' | 'salida'): string | null {
  let fecha: string | null = null
  let hora: string | null = null

  for (const [key, value] of Object.entries(data)) {
    const k = normalizarClaveFecha(key)
    if (!esClaveFechaMovimiento(k, tipo)) continue
    if (k.includes('fecha') || k.includes('date')) fecha = valorFecha(value)
    if (k.includes('hora') || k.includes('time')) hora = valorFecha(value)
  }

  if (fecha && hora) return `${fecha} ${hora}`
  if (fecha) return fecha
  if (hora) return hora
  return null
}

export function vistaFormulario(row: FormularioListado): FormularioVista {
  const db = row.dbColumns
  const datosGenerales = datosGeneralesDe(row.rawData)

  const tipo =
    valorDbColumna(db, 'tipo_formulario') ??
    row.tipo ??
    valorTexto(row.rawData.tipoFormulario) ??
    null

  const rawIngreso =
    valorFechaDb(db, 'fecha_ingreso', 'dg_fechaingreso') ??
    valorFecha(datosGenerales?.fechaIngreso) ??
    extraerFechaIngreso(row.data)

  const rawSalida =
    valorFechaDb(db, 'fecha_salida') ??
    valorFecha(datosGenerales?.fechaSalida) ??
    extraerFechaSalida(row.data)

  const chasis =
    valorDbColumna(db, 'dg_chasis') ??
    valorTexto(datosGenerales?.chasis) ??
    extraerChasis(row.data)

  const marca =
    valorDbColumna(db, 'dg_marca') ?? valorTexto(datosGenerales?.marca)

  return {
    tipo,
    tipoLabel: labelTipoFormulario(tipo),
    chasis,
    marca,
    fechaIngreso: rawIngreso,
    fechaSalida: rawSalida,
  }
}

function valorFechaDb(db: Record<string, unknown>, ...claves: string[]): string | null {
  for (const clave of claves) {
    const valor = db[clave]
    if (typeof valor === 'string' && valor.trim()) return valor.trim()
  }
  return null
}

export function formatearFechaFormulario(valor: string | null): string {
  if (!valor) return ''
  return formatearFechaCompacta(valor) ?? valor
}

function valorTexto(valor: unknown): string | null {
  if (typeof valor === 'string' && valor.trim()) return valor.trim()
  return null
}

function valorFecha(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'string') {
    const t = valor.trim()
    return t ? t : null
  }
  return null
}

function normalizarClaveFecha(clave: string): string {
  return clave.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function esClaveFechaMovimiento(claveNormalizada: string, tipo: 'ingreso' | 'salida'): boolean {
  const esIngreso =
    claveNormalizada.includes('fechaingreso') ||
    claveNormalizada.includes('horaingreso') ||
    claveNormalizada.endsWith('ingreso')
  const esSalida =
    claveNormalizada.includes('fechasalida') ||
    claveNormalizada.includes('horasalida') ||
    claveNormalizada.endsWith('salida')

  if (tipo === 'ingreso') return esIngreso && !esSalida
  return esSalida && !esIngreso
}

function pickPorPatron(data: Record<string, unknown>, patrones: string[]): string | null {
  for (const patron of patrones) {
    for (const [key, value] of Object.entries(data)) {
      const k = key.toLowerCase()
      if (k === patron || k.endsWith(`_${patron}`) || k.includes(patron)) {
        const parsed = valorSimple(value)
        if (parsed) return parsed
      }
    }
  }
  return null
}

function pickFecha(data: Record<string, unknown>, patrones: string[]): string | null {
  for (const patron of patrones) {
    for (const [key, value] of Object.entries(data)) {
      const k = normalizarClaveFecha(key)
      if (k !== patron && !k.endsWith(patron)) continue

      const parsed = valorFecha(value)
      if (parsed) return parsed
    }
  }
  return null
}

function valorSimple(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    const t = value.trim()
    if (t.startsWith('{') || t.startsWith('[')) return null
    return t
  }
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value)
  return null
}
