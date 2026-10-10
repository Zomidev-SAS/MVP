import Papa from 'papaparse'

export async function exportarChartComoPng(elementId: string, nombreArchivo: string): Promise<void> {
  const nodo = document.getElementById(elementId)
  if (!nodo) throw new Error(`No se encontró el elemento ${elementId} para exportar`)

  const svg = nodo.querySelector('svg')
  if (!svg) throw new Error('La gráfica no tiene un SVG renderizado todavía')

  // Los colores del tema (--color-xxx) se definen en un <style> que
  // ChartStyle inyecta como HERMANO del <svg>, dentro del div con
  // data-chart={chartId} (ver components/ui/chart.tsx). Ese <style> usa un
  // selector [data-chart=${chartId}] para acotar las variables CSS. Si solo
  // serializamos el <svg>, ese <style> y el atributo data-chart (que vive en
  // el div padre, no en el svg) no viajan con él, así que var(--color-xxx)
  // no tiene dónde resolverse y los fill caen a negro. Por eso clonamos el
  // svg, le copiamos el atributo data-chart y le inyectamos una copia del
  // <style> para que el documento SVG independiente sea autosuficiente.
  const wrapper = svg.closest('[data-chart]')
  const styleEl = wrapper?.querySelector('style')
  const cssText = styleEl?.textContent ?? ''

  // `cssText` solo resuelve un nivel de indirección: define
  // --color-cantidad: var(--chart-1), pero --chart-1 en sí está definido en
  // :root/.dark en app/globals.css, que tampoco viaja con el SVG
  // independiente. Sin ese segundo nivel, var(--chart-1) seguiría sin
  // resolverse y el fill caería a negro igual. Aquí aplanamos la cadena
  // reemplazando cada var(--xxx) por su valor computado real, tomado del
  // propio wrapper en vivo (que sí hereda --chart-1 desde :root/.dark).
  const cssTextResuelto = wrapper
    ? (() => {
        const computedStyle = getComputedStyle(wrapper)
        return cssText.replace(/var\((--[\w-]+)\)/g, (match, varName: string) => {
          const valor = computedStyle.getPropertyValue(varName).trim()
          return valor || match
        })
      })()
    : cssText

  const svgClone = svg.cloneNode(true) as SVGElement
  const chartDataId = wrapper?.getAttribute('data-chart') ?? ''
  svgClone.setAttribute('data-chart', chartDataId)

  if (cssTextResuelto) {
    const svgNs = 'http://www.w3.org/2000/svg'
    const defs = document.createElementNS(svgNs, 'defs')
    const styleTag = document.createElementNS(svgNs, 'style')
    styleTag.textContent = cssTextResuelto
    defs.appendChild(styleTag)
    svgClone.insertBefore(defs, svgClone.firstChild)
  }

  const xml = new XMLSerializer().serializeToString(svgClone)
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
