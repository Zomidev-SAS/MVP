import type { FragmentoTexto, LineaOcSiigo, OcSiigoLeida } from '@/lib/oc-documento/tipos'

interface Linea {
  y: number
  alto: number
  items: FragmentoTexto[]
  texto: string
}

const TOLERANCIA_Y = 3

/** Agrupa fragmentos que comparten renglón (misma altura) de izquierda a derecha. */
function agruparEnLineas(fragmentos: FragmentoTexto[]): Linea[] {
  const utiles = fragmentos.filter((f) => !f.rotado && f.texto.trim().length > 0)
  const ordenados = [...utiles].sort((a, b) => b.y - a.y || a.x - b.x)
  const lineas: Linea[] = []
  for (const f of ordenados) {
    const actual = lineas.find((l) => Math.abs(l.y - f.y) <= TOLERANCIA_Y)
    if (actual) {
      actual.items.push(f)
      actual.alto = Math.max(actual.alto, f.alto)
    } else {
      lineas.push({ y: f.y, alto: f.alto, items: [f], texto: '' })
    }
  }
  for (const l of lineas) {
    l.items.sort((a, b) => a.x - b.x)
    l.texto = l.items.map((i) => i.texto.trim()).join(' ').replace(/\s+/g, ' ').trim()
  }
  return lineas.sort((a, b) => b.y - a.y)
}

/** "6,600.00" → 6600 (formato Siigo: coma de miles, punto decimal). */
export function numeroSiigo(valor: string): number {
  const limpio = valor.replace(/[^\d.,-]/g, '')
  if (/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(limpio) || /^-?\d+(\.\d+)?$/.test(limpio)) {
    return Number(limpio.replace(/,/g, ''))
  }
  // Respaldo por si algún documento usa coma decimal: 6.600,00
  return Number(limpio.replace(/\./g, '').replace(',', '.'))
}

/** "860.508.098-3" → "860508098" (sin puntos ni dígito de verificación). */
export function nitSinDigitoVerificacion(valor: string): string {
  const base = valor.split('-')[0] ?? valor
  return base.replace(/\D/g, '')
}

const FILA_ITEM =
  /^(\d+)\s+(.+?)\s+(-?[\d.,]+)\s+(-?[\d.,]+)\s+(-?[\d.,]+)\s+(\d+(?:[.,]\d+)?)\s*%\s+(\d+(?:[.,]\d+)?)\s*%\s+(-?[\d.,]+)$/

const PALABRAS_TOTALES = /^(total bruto|descuentos?|subtotal|iva|total a pagar|reteica|retefuente|reteiva)/i

export class ErrorLecturaOc extends Error {}

/**
 * Lee la orden de compra que genera Siigo ("Orden de compra No. OC-1-3195").
 * Trabaja con la posición del texto para separar el bloque del proveedor (a la
 * derecha) del de Carrera Arango (a la izquierda).
 */
export function parsearOcSiigo(
  fragmentos: FragmentoTexto[],
  pagina: { ancho: number; alto: number }
): OcSiigoLeida {
  const lineas = agruparEnLineas(fragmentos)
  const textoPlano = lineas.map((l) => l.texto).join('\n')

  const numero = textoPlano.match(/\bOC-\d+-\d+\b/i)?.[0]?.toUpperCase()
  if (!numero) {
    throw new ErrorLecturaOc('No encontré el número de la orden (OC-…). ¿Es una orden de compra de Siigo?')
  }

  const indiceEncabezado = lineas.findIndex(
    (l) => /descripci[oó]n/i.test(l.texto) && /cantidad/i.test(l.texto)
  )
  if (indiceEncabezado < 0) {
    throw new ErrorLecturaOc('No encontré la tabla de productos de la orden.')
  }
  const encabezado = lineas[indiceEncabezado]
  const mitad = pagina.ancho * 0.5

  // --- Proveedor (cuadro a la derecha, sobre la tabla) ---------------------
  const derechaSuperior = lineas
    .slice(0, indiceEncabezado)
    .map((l) => ({
      ...l,
      texto: l.items
        .filter((i) => i.x >= mitad)
        .map((i) => i.texto.trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    }))
    .filter((l) => l.texto.length > 0)

  const indicePara = derechaSuperior.findIndex((l) => /^para\b/i.test(l.texto))
  if (indicePara < 0) {
    throw new ErrorLecturaOc('No encontré el proveedor ("Para") en la orden.')
  }

  const partesNombre: string[] = [derechaSuperior[indicePara].texto.replace(/^para\b\s*/i, '')]
  let nit: string | null = null
  let fecha: string | null = null
  for (const l of derechaSuperior.slice(indicePara + 1)) {
    const matchNit = l.texto.match(/^nit\b\s*:?\s*([\d.\-]+)/i)
    if (matchNit) {
      nit = nitSinDigitoVerificacion(matchNit[1])
      continue
    }
    const matchFecha = l.texto.match(/^fecha\b\s*:?\s*(\d{4}-\d{2}-\d{2})/i)
    if (matchFecha) {
      fecha = matchFecha[1]
      continue
    }
    if (nit === null && fecha === null) partesNombre.push(l.texto)
  }

  const proveedorNombre = partesNombre.join(' ').replace(/\s+/g, ' ').trim()
  if (!proveedorNit(nit) || !proveedorNombre) {
    throw new ErrorLecturaOc('No pude leer el nombre o el NIT del proveedor.')
  }

  // --- Filas de la tabla ---------------------------------------------------
  const filas = lineas.slice(indiceEncabezado + 1)
  const lineasOc: LineaOcSiigo[] = []
  let ultimaFilaItem: Linea | null = null
  for (const l of filas) {
    const m = l.texto.match(FILA_ITEM)
    if (m) {
      lineasOc.push({
        descripcion: m[2].trim(),
        cantidad: numeroSiigo(m[3]),
        precio_unitario: numeroSiigo(m[4]),
        total: numeroSiigo(m[8]),
      })
      ultimaFilaItem = l
      continue
    }
    // Después de la tabla vienen observaciones y totales: se termina de leer filas.
    const finDeTabla = l.items.some(
      (i) => /^observaciones/i.test(i.texto.trim()) || PALABRAS_TOTALES.test(i.texto.trim())
    )
    if (finDeTabla) break
    // Descripción larga partida en dos renglones: se suma a la fila anterior.
    if (
      ultimaFilaItem &&
      Math.abs(ultimaFilaItem.y - l.y) < (ultimaFilaItem.alto || 10) * 2.2 &&
      !/\d[.,]\d{2}\s*$/.test(l.texto)
    ) {
      lineasOc[lineasOc.length - 1].descripcion += ` ${l.texto}`
      ultimaFilaItem = l
    }
  }

  if (lineasOc.length === 0) {
    throw new ErrorLecturaOc('No pude leer ninguna línea de productos de la orden.')
  }

  // --- Observaciones (a la izquierda, bajo la tabla) y total ---------------
  const indiceObs = lineas.findIndex((l) => l.items.some((i) => /^observaciones/i.test(i.texto.trim())))
  let observaciones: string | null = null
  let xObservaciones: number | null = null
  let ySobreObservaciones: number | null = null
  if (indiceObs >= 0) {
    const lineaObs = lineas[indiceObs]
    const etiqueta = lineaObs.items.find((i) => /^observaciones/i.test(i.texto.trim()))!
    xObservaciones = etiqueta.x
    ySobreObservaciones = lineaObs.y + (lineaObs.alto || 10)
    const izquierda = lineas
      .slice(indiceObs)
      .map((l) =>
        l.items
          .filter((i) => i.x < mitad)
          .map((i) => i.texto.trim())
          .join(' ')
      )
      .map((t, idx) => (idx === 0 ? t.replace(/^observaciones:?\s*/i, '') : t))
      .map((t) => t.replace(/\s+/g, ' ').trim())
      .filter((t) => t.length > 0)
    observaciones = izquierda.join(' ') || null
  }

  const totalLinea = lineas.find((l) => /total a pagar/i.test(l.texto))
  const totalPagar = totalLinea
    ? numeroSiigo(totalLinea.texto.match(/total a pagar[^\d-]*([\d.,]+)\s*$/i)?.[1] ?? '')
    : null

  const yBajoTabla = ultimaFilaItem ? ultimaFilaItem.y - 6 : encabezado.y

  return {
    numero_oc: numero,
    fecha,
    proveedor_nombre: proveedorNombre,
    proveedor_nit: nit as string,
    observaciones,
    total_pagar: totalPagar !== null && Number.isFinite(totalPagar) ? totalPagar : null,
    lineas: lineasOc,
    diseño: {
      ancho: pagina.ancho,
      alto: pagina.alto,
      xObservaciones,
      yBajoTabla,
      ySobreObservaciones,
    },
  }
}

function proveedorNit(nit: string | null): nit is string {
  return Boolean(nit && nit.length >= 5)
}
