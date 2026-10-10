import Papa from 'papaparse'

export async function exportarChartComoPng(elementId: string, nombreArchivo: string): Promise<void> {
  const nodo = document.getElementById(elementId)
  if (!nodo) throw new Error(`No se encontró el elemento ${elementId} para exportar`)

  const svg = nodo.querySelector('svg')
  if (!svg) throw new Error('La gráfica no tiene un SVG renderizado todavía')

  const xml = new XMLSerializer().serializeToString(svg)
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = svg.clientWidth * 2
  canvas.height = svg.clientHeight * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear el contexto de canvas')
  ctx.scale(2, 2)
  ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#ffffff'
  ctx.fillRect(0, 0, svg.clientWidth, svg.clientHeight)
  ctx.drawImage(img, 0, 0, svg.clientWidth, svg.clientHeight)
  URL.revokeObjectURL(url)

  canvas.toBlob((blob) => {
    if (!blob) return
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${nombreArchivo}.png`
    link.click()
    URL.revokeObjectURL(link.href)
  })
}

export function exportarDatosComoCsv<T extends object>(data: T[], nombreArchivo: string): void {
  const csv = Papa.unparse(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${nombreArchivo}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}
