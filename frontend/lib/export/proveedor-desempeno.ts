import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { descargarCsv, generarCsv } from '@/lib/export/csv'
import { ETIQUETA_CALIDAD, type ConfigDesempeno } from '@/lib/proveedores/desempeno'
import { etiquetaOrden, type FilaHistorial } from '@/lib/proveedores/historial'
import { resumirDesempeno, type ResumenDesempeno } from '@/lib/proveedores/resumen'
import { ETIQUETA_ESTADO_OC } from '@/lib/types/orden-compra'

export interface ProveedorExportable {
  nombre: string
  nit: string
}

const COLOR_MARCA: [number, number, number] = [196, 30, 46]
const COLOR_PISTA: [number, number, number] = [232, 232, 232]
const COLOR_TEXTO_SUAVE = 110

export function fechaDmy(fecha: string | null): string {
  if (!fecha) return ''
  const [a, m, d] = fecha.split('-')
  return a && m && d ? `${d}/${m}/${a}` : fecha
}

export function numeroCsv(valor: number | null | undefined): string {
  if (valor == null) return ''
  return valor.toLocaleString('es-CO', { maximumFractionDigits: 1, useGrouping: false })
}

export function porcentajeTexto(valor: number | null | undefined): string {
  return valor == null ? 'N/A' : `${numeroCsv(valor)} %`
}

function estadoTexto(estado: FilaHistorial['estado']): string {
  return estado === 'historico' ? 'Histórico' : ETIQUETA_ESTADO_OC[estado]
}

export function slug(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 40) || 'proveedor'
  )
}

export function hoy(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

/** De la más antigua a la más reciente, como el cuadro de control de compras. */
export function cronologicas(filas: FilaHistorial[]): FilaHistorial[] {
  return [...filas].sort((a, b) => (a.fecha_oc ?? '').localeCompare(b.fecha_oc ?? ''))
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export const COLUMNAS_CSV = [
  'NÚMERO',
  'ORDEN DE COMPRA',
  'FECHA DE OC',
  'PROVEEDOR',
  'FECHA DE ENTREGA',
  'FECHA REAL DE ENTREGA',
  'DIFERENCIA EN DÍAS',
  'DEVOLUCIONES',
  'OBSERVACIONES',
  'FACTURA O REMISIÓN',
  'ESTADO',
  'CALIDAD',
  'CANTIDAD PEDIDA',
  'CANTIDAD RECIBIDA',
  'PUNTAJE CALIDAD',
  'PUNTAJE DEVOLUCIONES',
  'PUNTAJE CANTIDAD',
  'PUNTAJE TIEMPO',
  'CUMPLIMIENTO %',
]

function observacionesDeFila(fila: FilaHistorial): string {
  return [
    fila.observaciones,
    fila.calidad_comentario && `Calidad: ${fila.calidad_comentario}`,
    fila.devoluciones_detalle && `Devoluciones: ${fila.devoluciones_detalle}`,
    fila.tiempo_observaciones && `Tiempo: ${fila.tiempo_observaciones}`,
    fila.cantidad_observaciones && `Cantidad: ${fila.cantidad_observaciones}`,
    fila.pagos_acordados && `Pagos: ${fila.pagos_acordados}`,
  ]
    .filter(Boolean)
    .join(' | ')
}

export function filaCsv(fila: FilaHistorial, indice: number, proveedor: ProveedorExportable) {
  return [
    indice + 1,
    etiquetaOrden(fila),
    fechaDmy(fila.fecha_oc),
    proveedor.nombre,
    fechaDmy(fila.fecha_entrega_prometida),
    fechaDmy(fila.fecha_entrega_real),
    fila.diferencia_dias ?? '',
    fila.devoluciones,
    observacionesDeFila(fila),
    fila.factura_remision ?? '',
    estadoTexto(fila.estado),
    fila.calidad ? ETIQUETA_CALIDAD[fila.calidad] : '',
    numeroCsv(fila.cantidad_pedida),
    numeroCsv(fila.cantidad_recibida),
    numeroCsv(fila.puntajes?.calidad),
    numeroCsv(fila.puntajes?.devoluciones),
    numeroCsv(fila.puntajes?.cantidad),
    numeroCsv(fila.puntajes?.tiempo),
    numeroCsv(fila.puntajes?.global),
  ]
}

export function descargarCsvDesempeno(proveedor: ProveedorExportable, filas: FilaHistorial[]): void {
  const contenido = generarCsv(
    COLUMNAS_CSV,
    cronologicas(filas).map((fila, i) => filaCsv(fila, i, proveedor))
  )
  descargarCsv(`desempeno-${slug(proveedor.nombre)}-${hoy()}.csv`, contenido)
}

export function descargarCsvResultadoOc(proveedor: ProveedorExportable, fila: FilaHistorial): void {
  const contenido = generarCsv(COLUMNAS_CSV, [filaCsv(fila, 0, proveedor)])
  descargarCsv(`resultado-${slug(etiquetaOrden(fila))}-${slug(proveedor.nombre)}.csv`, contenido)
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/** Análisis en texto armado por reglas a partir de las cifras y observaciones. */
export function analisisDesempeno(
  resumen: ResumenDesempeno,
  filas: FilaHistorial[],
  config: ConfigDesempeno
): string[] {
  const lineas: string[] = []

  if (resumen.porcentaje == null) {
    lineas.push('Todavía no hay órdenes finalizadas para calificar a este proveedor.')
  } else {
    const supera = resumen.porcentaje >= config.umbral
    lineas.push(
      `Cumplimiento promedio de ${porcentajeTexto(resumen.porcentaje)} en ${resumen.calificadas} ` +
        `${resumen.calificadas === 1 ? 'orden calificada' : 'órdenes calificadas'}; ` +
        `${supera ? 'supera' : 'no alcanza'} el ${numeroCsv(config.umbral)} % requerido.`
    )
  }

  if (resumen.conRetraso > 0) {
    lineas.push(
      `${resumen.conRetraso} ${resumen.conRetraso === 1 ? 'entrega llegó' : 'entregas llegaron'} tarde, ` +
        `con ${numeroCsv(resumen.diasRetrasoPromedio)} días de retraso en promedio.`
    )
  } else if (resumen.calificadas > 0) {
    lineas.push('Todas las entregas con fecha llegaron a tiempo o antes.')
  }

  if (resumen.devoluciones > 0) {
    lineas.push(`Se registraron ${resumen.devoluciones} devoluciones.`)
  }

  const calidadBaja = filas.filter((f) => f.calidad === 'mal' || f.calidad === 'regular')
  if (calidadBaja.length > 0) {
    lineas.push(
      `${calidadBaja.length} ${calidadBaja.length === 1 ? 'orden tuvo' : 'órdenes tuvieron'} problemas de calidad: ` +
        calidadBaja
          .slice(0, 3)
          .map((f) => `${etiquetaOrden(f)} (${f.calidad ? ETIQUETA_CALIDAD[f.calidad] : ''})`)
          .join(', ') +
        '.'
    )
  }

  const notas = filas
    .flatMap((f) => [f.devoluciones_detalle, f.tiempo_observaciones, f.calidad_comentario])
    .filter((n): n is string => !!n?.trim())
    .slice(0, 4)
  if (notas.length > 0) {
    lineas.push(`Observaciones registradas: ${notas.join(' / ')}`)
  }

  return lineas
}

export function encabezado(doc: jsPDF, titulo: string, proveedor: ProveedorExportable, margen: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('PROCESO DE COMPRAS Y ALMACÉN', margen, 16)
  doc.setFontSize(11)
  doc.text(titulo, margen, 23)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Proveedor: ${proveedor.nombre}`, margen, 31)
  doc.text(`NIT: ${proveedor.nit}`, margen, 37)
  doc.setTextColor(COLOR_TEXTO_SUAVE)
  doc.text(`Generado el ${fechaDmy(hoy())} desde el panel de Carrera Arango`, margen, 43)
  doc.setTextColor(0)
  return 51
}

/** Barras de las cuatro divisiones, dibujadas con primitivas para no depender de imágenes. */
export function barrasDivisiones(
  doc: jsPDF,
  resumen: Pick<ResumenDesempeno, 'promedios'>,
  x: number,
  y: number
): number {
  const divisiones: Array<[string, number | null]> = [
    ['Calidad', resumen.promedios.calidad],
    ['Devoluciones', resumen.promedios.devoluciones],
    ['Cantidad', resumen.promedios.cantidad],
    ['Tiempo', resumen.promedios.tiempo],
  ]
  const anchoPista = 70
  doc.setFontSize(9)
  divisiones.forEach(([etiqueta, valor], i) => {
    const fila = y + i * 7
    doc.setTextColor(0)
    doc.text(etiqueta, x, fila + 3)
    doc.setFillColor(...COLOR_PISTA)
    doc.rect(x + 28, fila, anchoPista, 4, 'F')
    if (valor != null) {
      doc.setFillColor(...COLOR_MARCA)
      doc.rect(x + 28, fila, (anchoPista * Math.max(0, Math.min(100, valor))) / 100, 4, 'F')
    }
    doc.setTextColor(COLOR_TEXTO_SUAVE)
    doc.text(porcentajeTexto(valor), x + 28 + anchoPista + 4, fila + 3)
  })
  doc.setTextColor(0)
  return y + divisiones.length * 7 + 4
}

export function parrafos(doc: jsPDF, lineas: string[], x: number, y: number, ancho: number): number {
  doc.setFontSize(9.5)
  let cursor = y
  for (const linea of lineas) {
    const partes = doc.splitTextToSize(linea, ancho)
    doc.text(partes, x, cursor)
    cursor += partes.length * 4.6 + 1.5
  }
  return cursor
}

export function descargarPdfDesempeno(
  proveedor: ProveedorExportable,
  filas: FilaHistorial[],
  config: ConfigDesempeno
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
  const margen = 14
  const ancho = doc.internal.pageSize.getWidth() - margen * 2
  const resumen = resumirDesempeno(filas)

  let y = encabezado(doc, 'Control de desempeño del proveedor', proveedor, margen)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(porcentajeTexto(resumen.porcentaje), margen, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(COLOR_TEXTO_SUAVE)
  doc.text(
    `Cumplimiento promedio · ${resumen.calificadas} de ${resumen.total} órdenes calificadas · umbral ${numeroCsv(config.umbral)} %`,
    margen,
    y + 12
  )
  doc.setTextColor(0)

  // Barras a la derecha (etiqueta 28 mm + pista 70 mm + porcentaje 18 mm); el análisis a la izquierda.
  const anchoBarras = 28 + 70 + 18
  const finBarras = barrasDivisiones(doc, resumen, margen + ancho - anchoBarras, y - 2)
  const finAnalisis = parrafos(
    doc,
    analisisDesempeno(resumen, filas, config),
    margen,
    y + 22,
    ancho - anchoBarras - 10
  )
  y = Math.max(finBarras, finAnalisis)

  autoTable(doc, {
    startY: y + 2,
    head: [
      [
        '#',
        'Orden',
        'Fecha OC',
        'Entrega',
        'Real',
        'Dif. días',
        'Recibido',
        'Devol.',
        'Calidad',
        'Factura',
        'Estado',
        'Cumpl. %',
      ],
    ],
    body: cronologicas(filas).map((fila, i) => [
      String(i + 1),
      etiquetaOrden(fila),
      fechaDmy(fila.fecha_oc),
      fechaDmy(fila.fecha_entrega_prometida),
      fechaDmy(fila.fecha_entrega_real),
      fila.diferencia_dias == null ? '' : String(fila.diferencia_dias),
      fila.cantidad_pedida == null
        ? ''
        : `${numeroCsv(fila.cantidad_recibida ?? 0)} / ${numeroCsv(fila.cantidad_pedida)}`,
      String(fila.devoluciones),
      fila.calidad ? ETIQUETA_CALIDAD[fila.calidad] : '',
      fila.factura_remision ?? '',
      estadoTexto(fila.estado),
      fila.puntajes?.global == null ? '' : numeroCsv(fila.puntajes.global),
    ]),
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255 },
    columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 11: { halign: 'right' } },
    margin: { left: margen, right: margen },
  })

  doc.save(`desempeno-${slug(proveedor.nombre)}-${hoy()}.pdf`)
}

export function descargarPdfResultadoOc(
  proveedor: ProveedorExportable,
  fila: FilaHistorial,
  config: ConfigDesempeno
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const margen = 14
  const ancho = doc.internal.pageSize.getWidth() - margen * 2

  let y = encabezado(doc, `Resultado de la orden ${etiquetaOrden(fila)}`, proveedor, margen)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(porcentajeTexto(fila.puntajes?.global), margen, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(COLOR_TEXTO_SUAVE)
  doc.text(
    fila.puntajes
      ? `Cumplimiento de la orden · umbral ${numeroCsv(config.umbral)} %`
      : 'La orden sigue en curso: se califica cuando se finalice.',
    margen,
    y + 12
  )
  doc.setTextColor(0)
  y += 20

  autoTable(doc, {
    startY: y,
    head: [['División', 'Dato', 'Puntaje', 'Observación']],
    body: [
      [
        'Calidad',
        fila.calidad ? ETIQUETA_CALIDAD[fila.calidad] : 'Sin evaluar',
        porcentajeTexto(fila.puntajes?.calidad),
        fila.calidad_comentario ?? '',
      ],
      [
        'Devoluciones',
        String(fila.devoluciones),
        porcentajeTexto(fila.puntajes?.devoluciones),
        fila.devoluciones_detalle ?? '',
      ],
      [
        'Cantidad',
        fila.cantidad_pedida == null
          ? 'Sin cantidades'
          : `${numeroCsv(fila.cantidad_recibida ?? 0)} de ${numeroCsv(fila.cantidad_pedida)}`,
        porcentajeTexto(fila.puntajes?.cantidad),
        [fila.pagos_acordados && `Pagos: ${fila.pagos_acordados}`, fila.cantidad_observaciones]
          .filter(Boolean)
          .join(' · '),
      ],
      [
        'Tiempo',
        `Prometida ${fechaDmy(fila.fecha_entrega_prometida) || '—'} · real ${fechaDmy(fila.fecha_entrega_real) || '—'}` +
          (fila.diferencia_dias == null ? '' : ` (${fila.diferencia_dias} días)`),
        porcentajeTexto(fila.puntajes?.tiempo),
        fila.tiempo_observaciones ?? '',
      ],
    ],
    styles: { fontSize: 9, cellPadding: 2.2 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255 },
    columnStyles: { 2: { halign: 'right', cellWidth: 22 }, 0: { cellWidth: 28 } },
    margin: { left: margen, right: margen },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y + 40) + 8
  const datos = [
    `Fecha de la orden: ${fechaDmy(fila.fecha_oc) || '—'}`,
    `Factura o remisión: ${fila.factura_remision ?? '—'}`,
    `Estado: ${estadoTexto(fila.estado)}`,
    fila.observaciones ? `Observaciones: ${fila.observaciones}` : null,
    fila.actualizado_por_nombre ? `Última actualización: ${fila.actualizado_por_nombre}` : null,
  ].filter((l): l is string => l != null)
  parrafos(doc, datos, margen, y, ancho)

  doc.save(`resultado-${slug(etiquetaOrden(fila))}-${slug(proveedor.nombre)}.pdf`)
}
