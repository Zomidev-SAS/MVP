import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { DiseñoPagina } from '@/lib/oc-documento/tipos'

interface OpcionesFirma {
  pdf: Uint8Array
  firmaPng: Uint8Array
  nombre: string
  fecha: Date
  /** Hueco detectado al leer el documento; sin él se agrega una hoja de firma. */
  diseño: DiseñoPagina | null
}

const ALTO_LEYENDA = 11
const ALTO_MINIMO_HUECO = 66

function formatoFechaHora(fecha: Date): string {
  return fecha.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Estampa la firma en la hoja de la OC, en el espacio libre entre la tabla de
 * productos y las observaciones. Si ahí no cabe, agrega una hoja al final con
 * la firma, para no tapar el contenido del documento.
 */
export async function estamparFirma({
  pdf,
  firmaPng,
  nombre,
  fecha,
  diseño,
}: OpcionesFirma): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf)
  const imagen = await doc.embedPng(firmaPng)
  const fuente = await doc.embedFont(StandardFonts.Helvetica)
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold)
  const leyenda = `Firmado por ${nombre} · ${formatoFechaHora(fecha)}`

  const primera = doc.getPage(0)
  const hueco =
    diseño && diseño.yBajoTabla != null && diseño.ySobreObservaciones != null
      ? diseño.yBajoTabla - diseño.ySobreObservaciones
      : 0

  if (diseño && hueco >= ALTO_MINIMO_HUECO) {
    const x = diseño.xObservaciones ?? 48
    const altoFirma = Math.min(46, hueco - ALTO_LEYENDA - 12)
    const anchoFirma = (imagen.width / imagen.height) * altoFirma
    const yBase = (diseño.ySobreObservaciones as number) + 6

    primera.drawImage(imagen, { x, y: yBase + ALTO_LEYENDA + 2, width: anchoFirma, height: altoFirma })
    primera.drawLine({
      start: { x, y: yBase + ALTO_LEYENDA },
      end: { x: x + Math.max(anchoFirma, 170), y: yBase + ALTO_LEYENDA },
      thickness: 0.5,
      color: rgb(0.4, 0.4, 0.4),
    })
    primera.drawText(leyenda, { x, y: yBase, size: 6.5, font: fuente, color: rgb(0.25, 0.25, 0.25) })
  } else {
    const { width, height } = primera.getSize()
    const hoja = doc.addPage([width, height])
    const margen = 56
    hoja.drawText('Aprobación de la orden de compra', {
      x: margen,
      y: height - 96,
      size: 14,
      font: negrita,
      color: rgb(0.1, 0.1, 0.1),
    })
    const altoFirma = 80
    const anchoFirma = (imagen.width / imagen.height) * altoFirma
    hoja.drawImage(imagen, { x: margen, y: height - 200, width: anchoFirma, height: altoFirma })
    hoja.drawLine({
      start: { x: margen, y: height - 204 },
      end: { x: margen + Math.max(anchoFirma, 220), y: height - 204 },
      thickness: 0.6,
      color: rgb(0.4, 0.4, 0.4),
    })
    hoja.drawText(leyenda, { x: margen, y: height - 218, size: 9, font: fuente, color: rgb(0.25, 0.25, 0.25) })
  }

  return doc.save()
}
