import { datosGeneralesDe, valorDbColumna } from '@/lib/formularios/db-columns'
import type { FormularioListado } from '@/lib/types/formularios'
import { vistaFormulario } from '@/lib/types/formularios'

const MAX_PROFUNDIDAD = 8

export function textoBusquedaFormulario(fila: FormularioListado): string {
  const partes: string[] = [fila.id]

  if (fila.tipo) partes.push(fila.tipo)
  if (fila.created_at) partes.push(fila.created_at)

  partes.push(...extraerTextos(fila.dbColumns))
  partes.push(...extraerTextos(fila.rawData))

  return normalizarTextoBusqueda(partes.join(' '))
}

export function coincideFiltroLista(fila: FormularioListado, filtro: string): boolean {
  if (!filtro || filtro === 'todos') return true

  const separador = filtro.indexOf(':')
  if (separador === -1) {
    return textoBusquedaFormulario(fila).includes(normalizarTextoBusqueda(filtro))
  }

  const campo = filtro.slice(0, separador)
  const valor = filtro.slice(separador + 1)
  const valorNorm = normalizarTextoBusqueda(valor)
  if (!valorNorm) return true

  const db = fila.dbColumns
  const dg = datosGeneralesDe(fila.rawData)
  const vista = vistaFormulario(fila)

  const candidatos: Record<string, string | null | undefined> = {
    marca: vista.marca ?? valorDbColumna(db, 'dg_marca') ?? texto(dg?.marca),
    ciudad: valorDbColumna(db, 'dg_ciudad') ?? texto(dg?.ciudad),
    empresa: valorDbColumna(db, 'dg_empresa') ?? texto(dg?.empresa),
    tipo_vehiculo: valorDbColumna(db, 'dg_tipo') ?? texto(dg?.tipo),
  }

  const candidato = candidatos[campo]
  if (candidato && normalizarTextoBusqueda(candidato) === valorNorm) return true

  return textoBusquedaFormulario(fila).includes(valorNorm)
}

function texto(valor: unknown): string | null {
  if (typeof valor === 'string' && valor.trim()) return valor.trim()
  return null
}

export function coincideBusquedaFormulario(fila: FormularioListado, busqueda: string): boolean {
  const q = normalizarTextoBusqueda(busqueda)
  if (!q) return true

  const blob = textoBusquedaFormulario(fila)
  const tokens = q.split(/\s+/).filter(Boolean)

  return tokens.every((token) => blob.includes(token))
}

export function normalizarTextoBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

function extraerTextos(valor: unknown, profundidad = 0): string[] {
  if (profundidad > MAX_PROFUNDIDAD) return []
  if (valor === null || valor === undefined) return []

  if (typeof valor === 'string') {
    const t = valor.trim()
    if (!t || t.startsWith('http://') || t.startsWith('https://')) return []
    return [t]
  }

  if (typeof valor === 'number' && !Number.isNaN(valor)) return [String(valor)]
  if (typeof valor === 'boolean') return [valor ? 'si' : 'no']

  if (Array.isArray(valor)) {
    return valor.flatMap((item) => extraerTextos(item, profundidad + 1))
  }

  if (typeof valor === 'object') {
    return Object.values(valor as Record<string, unknown>).flatMap((item) =>
      extraerTextos(item, profundidad + 1)
    )
  }

  return []
}
