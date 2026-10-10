const JSON_COLUMNAS = new Set(['data', 'payload', 'contenido', 'form_data', 'json', 'metadata', 'body'])

/** Convierte filas anidadas o JSON string en pares planos legibles. */
export function aplanarDatos(obj: unknown, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (obj === null || obj === undefined) return result

  if (typeof obj === 'string') {
    const trimmed = obj.trim()
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return aplanarDatos(JSON.parse(trimmed), prefix)
      } catch {
        if (prefix) result[prefix] = trimmed
        return result
      }
    }
    if (prefix) result[prefix] = trimmed
    return result
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const path = prefix ? `${prefix}_${index + 1}` : String(index + 1)
      Object.assign(result, aplanarDatos(item, path))
    })
    return result
  }

  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}_${key}` : key
      if (value !== null && typeof value === 'object') {
        Object.assign(result, aplanarDatos(value, path))
      } else if (value !== undefined) {
        result[path] = value
      }
    }
    return result
  }

  if (prefix) result[prefix] = obj
  return result
}

export function aplanarFilaFormulario(row: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(row)) {
    if (['id', 'uuid', 'formulario_id'].includes(key)) continue
    const prefix = JSON_COLUMNAS.has(key) ? '' : key
    Object.assign(flat, aplanarDatos(value, prefix))
  }

  return flat
}
