import fs from 'node:fs'
import { cargarInventarioDesdeExcel, type InventarioExcelCargado } from '@/lib/inventario/parse-excel'
import { resolverRutaInventarioExcel } from '@/lib/inventario/excel-path'

let cache: { mtimeMs: number; datos: InventarioExcelCargado } | null = null

export function obtenerInventarioLocal(): InventarioExcelCargado | null {
  const ruta = resolverRutaInventarioExcel()
  if (!fs.existsSync(/* turbopackIgnore: true */ ruta)) return null

  const { mtimeMs } = fs.statSync(/* turbopackIgnore: true */ ruta)
  if (cache && cache.mtimeMs === mtimeMs) return cache.datos

  const datos = cargarInventarioDesdeExcel()
  if (!datos) return null

  cache = { mtimeMs, datos }
  return datos
}
