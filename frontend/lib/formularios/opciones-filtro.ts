import { datosGeneralesDe, valorDbColumna } from '@/lib/formularios/db-columns'
import type { FormularioListado } from '@/lib/types/formularios'

export interface OpcionFiltro {
  value: string
  label: string
  grupo: string
}

export function extraerOpcionesFiltro(filas: FormularioListado[]): OpcionFiltro[] {
  const marcas = new Set<string>()
  const ciudades = new Set<string>()
  const empresas = new Set<string>()
  const tiposVehiculo = new Set<string>()

  for (const fila of filas) {
    const db = fila.dbColumns
    const dg = datosGeneralesDe(fila.rawData)

    agregarValor(marcas, valorDbColumna(db, 'dg_marca') ?? texto(dg?.marca))
    agregarValor(ciudades, valorDbColumna(db, 'dg_ciudad') ?? texto(dg?.ciudad))
    agregarValor(empresas, valorDbColumna(db, 'dg_empresa') ?? texto(dg?.empresa))
    agregarValor(tiposVehiculo, valorDbColumna(db, 'dg_tipo') ?? texto(dg?.tipo))
  }

  const opciones: OpcionFiltro[] = [{ value: 'todos', label: 'Todos', grupo: 'General' }]

  for (const valor of ordenarSet(marcas)) {
    opciones.push({ value: `marca:${valor}`, label: valor, grupo: 'Marca' })
  }
  for (const valor of ordenarSet(ciudades)) {
    opciones.push({ value: `ciudad:${valor}`, label: valor, grupo: 'Ciudad' })
  }
  for (const valor of ordenarSet(empresas)) {
    opciones.push({ value: `empresa:${valor}`, label: valor, grupo: 'Empresa' })
  }
  for (const valor of ordenarSet(tiposVehiculo)) {
    opciones.push({ value: `tipo_vehiculo:${valor}`, label: valor, grupo: 'Tipo vehículo' })
  }

  return opciones
}

function agregarValor(set: Set<string>, valor: string | null) {
  if (!valor) return
  set.add(valor)
}

function texto(valor: unknown): string | null {
  if (typeof valor === 'string' && valor.trim()) return valor.trim()
  return null
}

function ordenarSet(valores: Set<string>): string[] {
  return [...valores].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
}
