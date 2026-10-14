import Papa from 'papaparse'

// Los colores del tema (--color-xxx) se definen en un <style> que ChartStyle
// inyecta como HERMANO del <svg>, dentro del div con data-chart={chartId}
// (ver components/ui/chart.tsx). Ese <style> usa un selector
// [data-chart=${chartId}] para acotar las variables CSS. Si solo
// serializamos el <svg>, ese <style> y el atributo data-chart (que vive en
// el div padre, no en el svg) no viajan con él, así que var(--color-xxx) no
// tiene dónde resolverse y los fill caen a negro. Por eso clonamos el svg,
// le copiamos el atributo data-chart y le inyectamos una copia del <style>
// para que el documento SVG independiente sea autosuficiente.
//
// `cssText` solo resuelve un nivel de indirección: define
// --color-cantidad: var(--chart-1), pero --chart-1 en sí está definido en
// :root/.dark en app/globals.css, que tampoco viaja con el SVG
// independiente. Aquí aplanamos la cadena reemplazando cada var(--xxx) por
// su valor computado real, tomado del propio wrapper en vivo.
//
// app/globals.css define esos colores en oklch()/lab() (CSS Color 4).
// getComputedStyle() devuelve el valor ya en esa misma notación, pero el
// decodificador de imágenes que rasteriza el SVG standalone (el <img
// src="blob:..."> de abajo) no la entiende — en vez de fallar entero,
// silenciosamente trata el color como inválido y el fill cae a negro.
// Canvas2D sí entiende oklch()/lab() como fillStyle, pero Chrome moderno lo
// conserva tal cual al releerlo (no lo normaliza a rgb() como antes), así
// que un simple round-trip por fillStyle no alcanza. Lo que sí es estable:
// pintar 1 pixel con ese color y leer sus bytes reales vía getImageData,
// que siempre vuelve en sRGB 0-255 sin importar el espacio de color de
// entrada — de ahí se arma un rgb()/rgba() plano, universalmente soportado.
function normalizarColor(valor: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return valor
  try {
    ctx.fillStyle = valor
    ctx.fillRect(0, 0, 1, 1)
  } catch {
    return valor
  }
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
  return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`
}

function construirSvgStandalone(nodo: HTMLElement): { svgOriginal: SVGSVGElement; xml: string } {
  // nodo también contiene el ícono de descarga (otro <svg>, de lucide-react)
  // en el header de la gráfica; .recharts-surface apunta puntualmente al SVG
  // que dibuja recharts, nunca al ícono.
  const svgOriginal = nodo.querySelector<SVGSVGElement>('svg.recharts-surface')
  if (!svgOriginal) throw new Error('La gráfica no tiene un SVG renderizado todavía')

  const wrapper = svgOriginal.closest('[data-chart]')
  const styleEl = wrapper?.querySelector('style')
  const cssText = styleEl?.textContent ?? ''

  const cssTextResuelto = wrapper
    ? (() => {
        const computedStyle = getComputedStyle(wrapper)
        return cssText.replace(/var\((--[\w-]+)\)/g, (match, varName: string) => {
          const valor = computedStyle.getPropertyValue(varName).trim()
          return valor ? normalizarColor(valor) : match
        })
      })()
    : cssText

  const svgClone = svgOriginal.cloneNode(true) as SVGSVGElement
  const chartDataId = wrapper?.getAttribute('data-chart') ?? ''
  svgClone.setAttribute('data-chart', chartDataId)
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  // El clon puede perder el tamaño en px si recharts lo dejó en % (el
  // tamaño real solo existe mientras está montado y layouteado dentro del
  // ResponsiveContainer); sin width/height explícitos, un visor standalone
  // (o el <img> usado para rasterizar a PNG) no sabe qué tamaño dibujar.
  const ancho = svgOriginal.clientWidth || 800
  const alto = svgOriginal.clientHeight || 400
  svgClone.setAttribute('width', String(ancho))
  svgClone.setAttribute('height', String(alto))
  if (!svgClone.getAttribute('viewBox')) {
    svgClone.setAttribute('viewBox', `0 0 ${ancho} ${alto}`)
  }

  if (cssTextResuelto) {
    const svgNs = 'http://www.w3.org/2000/svg'
    const defs = document.createElementNS(svgNs, 'defs')
    const styleTag = document.createElementNS(svgNs, 'style')
    styleTag.textContent = cssTextResuelto
    defs.appendChild(styleTag)
    svgClone.insertBefore(defs, svgClone.firstChild)
  }

  const xml = new XMLSerializer().serializeToString(svgClone)
  return { svgOriginal, xml }
}

function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = nombreArchivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(link.href)
}

export async function exportarChartComoPng(elementId: string, nombreArchivo: string): Promise<void> {
  const nodo = document.getElementById(elementId)
  if (!nodo) throw new Error(`No se encontró el elemento ${elementId} para exportar`)

  const { svgOriginal, xml } = construirSvgStandalone(nodo)
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('No se pudo rasterizar el SVG de la gráfica'))
      img.src = url
    })

    const ancho = svgOriginal.clientWidth || 800
    const alto = svgOriginal.clientHeight || 400
    const canvas = document.createElement('canvas')
    canvas.width = ancho * 2
    canvas.height = alto * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No se pudo crear el contexto de canvas')
    ctx.scale(2, 2)
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor
    if (!ctx.fillStyle || ctx.fillStyle === 'rgba(0, 0, 0, 0)') ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ancho, alto)
    ctx.drawImage(img, 0, 0, ancho, alto)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve))
    if (!blob) throw new Error('No se pudo generar el PNG a partir del canvas')
    descargarBlob(blob, `${nombreArchivo}.png`)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function exportarChartComoSvg(elementId: string, nombreArchivo: string): void {
  const nodo = document.getElementById(elementId)
  if (!nodo) throw new Error(`No se encontró el elemento ${elementId} para exportar`)

  const { xml } = construirSvgStandalone(nodo)
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  descargarBlob(blob, `${nombreArchivo}.svg`)
}

export function exportarDatosComoCsv<T extends object>(data: T[], nombreArchivo: string): void {
  // escapeFormulae: evita inyección de fórmulas — nombres de producto/categoría
  // vienen de la BD y el CSV se abre típicamente en Excel; una celda que empiece
  // con =, +, - o @ podría ejecutarse como fórmula si no se escapa.
  const csv = Papa.unparse(data, { escapeFormulae: true })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  descargarBlob(blob, `${nombreArchivo}.csv`)
}
