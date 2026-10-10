const COLUMNAS_OMITIR = new Set(['id', 'uuid', 'formulario_id', 'data'])

export function extraerDbColumns(row: Record<string, unknown>): Record<string, unknown> {
  const columnas: Record<string, unknown> = {}

  for (const [clave, valor] of Object.entries(row)) {
    if (COLUMNAS_OMITIR.has(clave)) continue
    if (valor === null || valor === undefined) continue
    columnas[clave] = valor
  }

  return columnas
}

export function valorDbColumna(db: Record<string, unknown>, ...claves: string[]): string | null {
  for (const clave of claves) {
    const valor = db[clave]
    if (typeof valor === 'string' && valor.trim()) return valor.trim()
    if (typeof valor === 'number' && !Number.isNaN(valor)) return String(valor)
  }
  return null
}

export function datosGeneralesDe(raw: Record<string, unknown>): Record<string, unknown> | null {
  const dg = raw.datosGenerales
  if (dg && typeof dg === 'object' && !Array.isArray(dg)) {
    return dg as Record<string, unknown>
  }
  return null
}
