import fs from 'node:fs'
import * as XLSX from 'xlsx'
import type { InventarioItem } from '@/lib/types/inventario'
import { resolverRutaInventarioExcel } from '@/lib/inventario/excel-path'

const COLUMNAS_UBICACION = [
  'Sin Asignar',
  'ALMACEN NIVEL 1',
  'ALMACEN NIVEL 2',
  'ALMACEN NIVEL 3',
  'METALMECANICA',
  'PRODUCTO TERMINADO',
  'MADERAS',
  'DESCANSABRAZOS',
  'AUDIO Y VIDEO',
] as const

export interface InventarioExcelCargado {
  filas: InventarioItem[]
  fechaCorte: string | null
  archivo: string
}

export function cargarInventarioDesdeExcel(): InventarioExcelCargado | null {
  const archivo = resolverRutaInventarioExcel()
  if (!fs.existsSync(/* turbopackIgnore: true */ archivo)) return null

  const buffer = fs.readFileSync(/* turbopackIgnore: true */ archivo)
  return parsearInventarioExcelBuffer(buffer, archivo)
}

export function parsearInventarioExcelBuffer(
  buffer: Buffer | ArrayBuffer,
  nombreArchivo = 'inventario.xlsx'
): InventarioExcelCargado | null {
  const libro = XLSX.read(buffer, { type: 'buffer' })
  const hoja = libro.Sheets[libro.SheetNames[0]]
  if (!hoja) return null

  const matriz = XLSX.utils.sheet_to_json<(string | number | null)[]>(hoja, {
    header: 1,
    defval: '',
    raw: true,
  })

  const indiceEncabezado = matriz.findIndex(
    (fila) => normalizarTexto(String(fila[0] ?? '')) === 'codigo producto'
  )
  if (indiceEncabezado === -1) return null

  const encabezados = matriz[indiceEncabezado].map((c) => String(c ?? '').trim())
  const indice = indexarColumnas(encabezados)
  const fechaCorte = extraerFechaCorte(matriz, indiceEncabezado)

  const filas: InventarioItem[] = []

  for (let i = indiceEncabezado + 1; i < matriz.length; i++) {
    const fila = matriz[i]
    if (!fila || fila.every((celda) => String(celda ?? '').trim() === '')) continue

    const codigo = String(fila[indice.codigo] ?? '').trim()
    if (!codigo) continue

    const stocks = COLUMNAS_UBICACION.map((nombre) => ({
      nombre,
      cantidad: parsearNumero(fila[indice.ubicaciones[nombre]]),
    }))

    const ubicacion = ubicacionPrincipal(stocks)
    const saldo =
      parsearNumero(fila[indice.totalBodegas]) || stocks.reduce((s, u) => s + u.cantidad, 0)

    filas.push({
      codigo,
      nombre: texto(fila[indice.nombre]),
      vin: null,
      marca: null,
      categoria: texto(fila[indice.categoria]),
      ubicacion,
      unidad: texto(fila[indice.unidad]),
      saldo,
      valor_unitario: parsearNumero(fila[indice.valorUnitario]) || null,
      valor_total: parsearNumero(fila[indice.valorTotal]),
      ultimo_movimiento: fechaCorte,
    })
  }

  return { filas, fechaCorte, archivo: nombreArchivo }
}

function indexarColumnas(encabezados: string[]) {
  const mapa = new Map(encabezados.map((nombre, i) => [normalizarTexto(nombre), i]))

  const ubicaciones = Object.fromEntries(
    COLUMNAS_UBICACION.map((nombre) => [nombre, mapa.get(normalizarTexto(nombre)) ?? -1])
  ) as Record<(typeof COLUMNAS_UBICACION)[number], number>

  return {
    codigo: mapa.get('codigo producto') ?? 0,
    nombre: mapa.get('nombre producto') ?? 1,
    unidad: mapa.get('unidad de medida') ?? 2,
    ubicaciones,
    categoria: mapa.get('categoria de inventario') ?? -1,
    totalBodegas: mapa.get('total en bodegas') ?? -1,
    valorUnitario: mapa.get('valor unitario aproximado') ?? -1,
    valorTotal: mapa.get('valor total aproximado') ?? -1,
  }
}

function extraerFechaCorte(
  matriz: (string | number | null)[][],
  indiceEncabezado: number
): string | null {
  for (let i = indiceEncabezado - 1; i >= 0; i--) {
    const textoFila = String(matriz[i]?.[0] ?? '').trim()
    if (textoFila && /^\w+,\s*\d/.test(textoFila)) return textoFila
  }
  return null
}

function ubicacionPrincipal(stocks: Array<{ nombre: string; cantidad: number }>): string | null {
  let mejor: { nombre: string; cantidad: number } | null = null

  for (const stock of stocks) {
    if (stock.cantidad <= 0) continue
    if (!mejor || stock.cantidad > mejor.cantidad) mejor = stock
  }

  return mejor?.nombre ?? null
}

function parsearNumero(valor: unknown): number {
  if (typeof valor === 'number' && !Number.isNaN(valor)) return valor
  if (typeof valor !== 'string') return 0

  const t = valor.trim().replace(/\s/g, '')
  if (!t) return 0

  if (t.includes(',') && t.includes('.')) {
    const n = Number(t.replace(/,/g, ''))
    return Number.isNaN(n) ? 0 : n
  }

  if (/\d,\d/.test(t)) {
    const n = Number(t.replace(/\./g, '').replace(',', '.'))
    return Number.isNaN(n) ? 0 : n
  }

  const n = Number(t)
  return Number.isNaN(n) ? 0 : n
}

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null
  const t = String(valor).trim()
  return t ? t : null
}

function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}
