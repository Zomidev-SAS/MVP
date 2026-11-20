import Papa from 'papaparse'

/**
 * CSV que abre bien en Excel en español: separador `;`, UTF-8 con BOM (tildes) y
 * fórmulas escapadas para que un texto como "=SUMA(...)" no se ejecute al abrirlo.
 */
export function generarCsv(columnas: string[], filas: (string | number | null)[][]): string {
  const csv = Papa.unparse(
    { fields: columnas, data: filas },
    { delimiter: ';', newline: '\r\n', escapeFormulae: true }
  )
  return `﻿${csv}`
}

export function descargarCsv(nombreArchivo: string, contenido: string): void {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  enlace.click()
  URL.revokeObjectURL(url)
}
