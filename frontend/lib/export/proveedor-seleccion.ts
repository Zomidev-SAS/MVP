import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { descargarCsv, generarCsv } from '@/lib/export/csv'
import { fechaDmy, hoy, numeroCsv, parrafos, slug } from '@/lib/export/proveedor-desempeno'
import { ETIQUETA_CALIDAD, type Calidad } from '@/lib/proveedores/desempeno'
import { compararCandidatos } from '@/lib/proveedores/seleccion'

export interface CandidatoExportable {
  nombre: string
  es_nuevo: boolean
  precio: number | null
  tiempo_entrega_dias: number | null
  calidad: Calidad | null
  observaciones: string | null
}

export interface SeleccionExportable {
  titulo: string
  necesidad: string | null
  conclusion: string | null
  estado: 'borrador' | 'decidida'
  /** Índice del candidato elegido, o null. */
  elegido: number | null
  candidatos: CandidatoExportable[]
}

function precioTexto(valor: number | null): string {
  return valor == null ? '' : `$${valor.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}

export function descargarCsvSeleccion(seleccion: SeleccionExportable): void {
  const { puntajes, recomendado } = compararCandidatos(seleccion.candidatos)
  const filas = seleccion.candidatos.map((c, i) => [
    c.nombre,
    c.es_nuevo ? 'Sí' : 'No',
    c.precio == null ? '' : numeroCsv(c.precio),
    numeroCsv(c.tiempo_entrega_dias),
    c.calidad ? ETIQUETA_CALIDAD[c.calidad] : '',
    numeroCsv(puntajes[i].precio),
    numeroCsv(puntajes[i].tiempo),
    numeroCsv(puntajes[i].calidad),
    numeroCsv(puntajes[i].global),
    recomendado === i ? 'Sí' : '',
    seleccion.elegido === i ? 'Sí' : '',
    c.observaciones ?? '',
  ])
  const contenido = generarCsv(
    [
      'PROVEEDOR',
      'NUEVO',
      'PRECIO',
      'TIEMPO DE ENTREGA (DÍAS)',
      'CALIDAD',
      'PUNTAJE PRECIO',
      'PUNTAJE TIEMPO',
      'PUNTAJE CALIDAD',
      'PUNTAJE GLOBAL',
      'RECOMENDADO',
      'ELEGIDO',
      'OBSERVACIONES',
    ],
    [...filas, [], ['Evaluación', seleccion.titulo], ['Conclusión', seleccion.conclusion ?? '']]
  )
  descargarCsv(`seleccion-${slug(seleccion.titulo)}-${hoy()}.csv`, contenido)
}

export function descargarPdfSeleccion(seleccion: SeleccionExportable): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
  const margen = 14
  const ancho = doc.internal.pageSize.getWidth() - margen * 2
  const { mejores, puntajes, recomendado } = compararCandidatos(seleccion.candidatos)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('PROCESO DE COMPRAS Y ALMACÉN', margen, 16)
  doc.setFontSize(11)
  doc.text('Evaluación de selección de proveedores', margen, 23)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Evaluación: ${seleccion.titulo}`, margen, 31)
  doc.setTextColor(110)
  doc.text(
    `${seleccion.estado === 'decidida' ? 'Decidida' : 'Borrador'} · generado el ${fechaDmy(hoy())} desde el panel de Carrera Arango`,
    margen,
    37
  )
  doc.setTextColor(0)

  let y = 45
  if (seleccion.necesidad) y = parrafos(doc, [`Necesidad: ${seleccion.necesidad}`], margen, y, ancho)

  const nombres = seleccion.candidatos.map(
    (c, i) =>
      `${c.nombre}${c.es_nuevo ? ' (nuevo)' : ''}${recomendado === i ? ' · recomendado' : ''}${seleccion.elegido === i ? ' · ELEGIDO' : ''}`
  )
  const marcar = (texto: string, esMejor: boolean) => (esMejor && texto ? `${texto} *` : texto)

  autoTable(doc, {
    startY: y + 2,
    head: [['Criterio', ...nombres]],
    body: [
      [
        'Precio',
        ...seleccion.candidatos.map((c) =>
          marcar(precioTexto(c.precio), c.precio != null && c.precio === mejores.precio)
        ),
      ],
      [
        'Tiempo de entrega',
        ...seleccion.candidatos.map((c) =>
          marcar(
            c.tiempo_entrega_dias == null ? '' : `${numeroCsv(c.tiempo_entrega_dias)} días`,
            c.tiempo_entrega_dias != null && c.tiempo_entrega_dias === mejores.tiempo
          )
        ),
      ],
      [
        'Calidad',
        ...seleccion.candidatos.map((c, i) =>
          marcar(
            c.calidad ? ETIQUETA_CALIDAD[c.calidad] : '',
            puntajes[i].calidad != null && puntajes[i].calidad === mejores.calidad
          )
        ),
      ],
      ['Puntaje global', ...puntajes.map((p) => (p.global == null ? '' : `${numeroCsv(p.global)} / 100`))],
      ['Observaciones', ...seleccion.candidatos.map((c) => c.observaciones ?? '')],
    ],
    styles: { fontSize: 9, cellPadding: 2.4, valign: 'top' },
    headStyles: { fillColor: [40, 40, 40], textColor: 255 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 38 } },
    margin: { left: margen, right: margen },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y + 50) + 5
  doc.setFontSize(8)
  doc.setTextColor(110)
  doc.text(
    '* Mejor valor del criterio. Puntaje: precio y tiempo en proporción al mejor (100), calidad Bien 100 / Regular 50 / Mal 0.',
    margen,
    y
  )
  doc.setTextColor(0)
  y += 8

  if (seleccion.conclusion) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Conclusión', margen, y)
    doc.setFont('helvetica', 'normal')
    y = parrafos(doc, [seleccion.conclusion], margen, y + 5, ancho) + 4
  }

  y = Math.max(y + 12, doc.internal.pageSize.getHeight() - 30)
  doc.setDrawColor(150)
  doc.setFontSize(9)
  ;['Elaboró (compras)', 'Revisó (auditoría)', 'Aprobó (supervisor)'].forEach((rotulo, i) => {
    const x = margen + i * 84
    doc.line(x, y, x + 70, y)
    doc.text(rotulo, x, y + 5)
  })

  doc.save(`seleccion-${slug(seleccion.titulo)}-${hoy()}.pdf`)
}
