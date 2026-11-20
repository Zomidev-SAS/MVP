import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { descargarCsv, generarCsv } from '@/lib/export/csv'
import {
  COLUMNAS_CSV,
  barrasDivisiones,
  cronologicas,
  encabezado,
  fechaDmy,
  filaCsv,
  numeroCsv,
  parrafos,
  porcentajeTexto,
  slug,
  type ProveedorExportable,
} from '@/lib/export/proveedor-desempeno'
import { ETIQUETA_CALIDAD } from '@/lib/proveedores/desempeno'
import { etiquetaOrden, type FilaHistorial } from '@/lib/proveedores/historial'
import { ETIQUETA_RESULTADO, type Reevaluacion } from '@/lib/types/proveedor-reevaluacion'

function fechaDeRegistro(timestamp: string): string {
  return fechaDmy(new Date(timestamp).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }))
}

function nombreArchivo(proveedor: ProveedorExportable, anio: number, extension: string): string {
  return `reevaluacion-${anio}-${slug(proveedor.nombre)}.${extension}`
}

/** CSV con el resumen de la reevaluación arriba y las órdenes del año debajo. */
export function descargarCsvReevaluacion(
  proveedor: ProveedorExportable,
  reevaluacion: Reevaluacion,
  filasDelAnio: FilaHistorial[]
): void {
  const d = reevaluacion.detalle
  const resumen = generarCsv(
    ['CONSTANCIA DE REEVALUACIÓN ANUAL', ''],
    [
      ['Proveedor', proveedor.nombre],
      ['NIT', proveedor.nit],
      ['Año evaluado', reevaluacion.anio],
      ['Cumplimiento %', numeroCsv(reevaluacion.porcentaje)],
      ['Umbral %', numeroCsv(reevaluacion.umbral)],
      ['Decisión', ETIQUETA_RESULTADO[reevaluacion.resultado]],
      ['Motivo', reevaluacion.motivo ?? ''],
      ['Órdenes calificadas', `${d.calificadas} de ${d.total}`],
      ['Entregas con retraso', d.conRetraso],
      ['Días de retraso promedio', numeroCsv(d.diasRetrasoPromedio)],
      ['Devoluciones', d.devoluciones],
      ['Calidad %', numeroCsv(d.promedios.calidad)],
      ['Devoluciones %', numeroCsv(d.promedios.devoluciones)],
      ['Cantidad %', numeroCsv(d.promedios.cantidad)],
      ['Tiempo %', numeroCsv(d.promedios.tiempo)],
      ['Registrada por', reevaluacion.creado_por_nombre ?? ''],
      ['Fecha de registro', fechaDeRegistro(reevaluacion.updated_at)],
    ]
  )
  const ordenes = generarCsv(
    COLUMNAS_CSV,
    cronologicas(filasDelAnio).map((fila, i) => filaCsv(fila, i, proveedor))
  ).replace(/^﻿/, '')

  descargarCsv(nombreArchivo(proveedor, reevaluacion.anio, 'csv'), `${resumen}\r\n\r\n${ordenes}`)
}

export function descargarPdfReevaluacion(
  proveedor: ProveedorExportable,
  reevaluacion: Reevaluacion,
  filasDelAnio: FilaHistorial[]
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const margen = 14
  const ancho = doc.internal.pageSize.getWidth() - margen * 2
  const d = reevaluacion.detalle

  let y = encabezado(doc, `Constancia de reevaluación anual ${reevaluacion.anio}`, proveedor, margen)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text(porcentajeTexto(reevaluacion.porcentaje), margen, y + 6)
  doc.setFontSize(12)
  doc.text(ETIQUETA_RESULTADO[reevaluacion.resultado].toUpperCase(), margen + 60, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(110)
  doc.text(
    `Cumplimiento del año · umbral ${numeroCsv(reevaluacion.umbral)} % · ` +
      `${reevaluacion.porcentaje >= reevaluacion.umbral ? 'aprueba' : 'no alcanza el umbral'}`,
    margen,
    y + 12
  )
  doc.setTextColor(0)
  y += 20

  const lineas = [
    `${d.calificadas} de ${d.total} órdenes calificadas en ${reevaluacion.anio}.`,
    d.conRetraso > 0
      ? `${d.conRetraso} entregas con retraso (${numeroCsv(d.diasRetrasoPromedio)} días en promedio).`
      : 'Ninguna entrega con retraso.',
    `${d.devoluciones} devoluciones registradas.`,
    `Pesos usados: calidad ${d.pesos.calidad}, devoluciones ${d.pesos.devoluciones}, cantidad ${d.pesos.cantidad}, ` +
      `tiempo ${d.pesos.tiempo}; ${numeroCsv(d.penalizacionDia)} puntos por día de retraso y ` +
      `${numeroCsv(d.penalizacionDevolucion)} por devolución.`,
  ]
  const finTexto = parrafos(doc, lineas, margen, y, ancho - 125)
  const finBarras = barrasDivisiones(doc, { promedios: d.promedios }, margen + ancho - 116, y - 3)
  y = Math.max(finTexto, finBarras) + 2

  if (reevaluacion.motivo) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Motivo de la decisión', margen, y)
    doc.setFont('helvetica', 'normal')
    y = parrafos(doc, [reevaluacion.motivo], margen, y + 5, ancho) + 2
  }

  autoTable(doc, {
    startY: y + 2,
    head: [['Orden', 'Fecha OC', 'Entrega', 'Real', 'Dif.', 'Devol.', 'Calidad', 'Factura', 'Cumpl. %']],
    body: cronologicas(filasDelAnio).map((fila) => [
      etiquetaOrden(fila),
      fechaDmy(fila.fecha_oc),
      fechaDmy(fila.fecha_entrega_prometida),
      fechaDmy(fila.fecha_entrega_real),
      fila.diferencia_dias == null ? '' : String(fila.diferencia_dias),
      String(fila.devoluciones),
      fila.calidad ? ETIQUETA_CALIDAD[fila.calidad] : '',
      fila.factura_remision ?? '',
      fila.puntajes?.global == null ? '' : numeroCsv(fila.puntajes.global),
    ]),
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255 },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 8: { halign: 'right' } },
    margin: { left: margen, right: margen },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y + 40) + 18
  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage()
    y = 30
  }

  doc.setFontSize(9)
  doc.setDrawColor(150)
  const columnas = [margen, margen + 64, margen + 128]
  const firmas = ['Evaluó (compras)', 'Revisó (auditoría)', 'Aprobó (supervisor)']
  firmas.forEach((rotulo, i) => {
    doc.line(columnas[i], y, columnas[i] + 54, y)
    doc.text(rotulo, columnas[i], y + 5)
  })

  doc.setTextColor(110)
  doc.text(
    `Registrada en el panel por ${reevaluacion.creado_por_nombre ?? 'sin nombre'} el ${fechaDeRegistro(reevaluacion.updated_at)}.`,
    margen,
    y + 16
  )
  doc.setTextColor(0)

  doc.save(nombreArchivo(proveedor, reevaluacion.anio, 'pdf'))
}
