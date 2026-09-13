import fs from 'node:fs'
import path from 'node:path'

const NOMBRE_ARCHIVO = 'Saldos de inventario.xlsx'

export function resolverRutaInventarioExcel(): string {
  const personalizada = process.env.INVENTARIO_EXCEL_PATH?.trim()
  if (personalizada) return path.resolve(personalizada)

  const candidatos = [
    path.resolve(process.cwd(), '..', 'archivos', NOMBRE_ARCHIVO),
    path.resolve(process.cwd(), 'archivos', NOMBRE_ARCHIVO),
  ]

  for (const candidato of candidatos) {
    if (fs.existsSync(/* turbopackIgnore: true */ candidato)) return candidato
  }

  return candidatos[0]
}

export function existeInventarioExcel(): boolean {
  return fs.existsSync(/* turbopackIgnore: true */ resolverRutaInventarioExcel())
}
