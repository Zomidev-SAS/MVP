import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { OrdenCompra } from '@/lib/types/orden-compra'
import { tituloOrdenDisplay } from '@/lib/types/orden-compra'

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

/** PDF listo para cargar en Siigo Nube (formato operativo multi-proveedor / multi-producto). */
export function generarPdfOrdenCompra(orden: OrdenCompra): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const titulo = tituloOrdenDisplay(orden)
  const margen = 14

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('ORDEN DE COMPRA', margen, 18)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Carrera Arango — Panel de compras', margen, 26)

  doc.setFontSize(10)
  doc.text(`Referencia panel: OC-PANEL-${orden.id}`, margen, 34)
  doc.text(`Pedido: ${titulo}`, margen, 40)
  doc.text(`Fecha elaboración: ${formatearFecha(orden.fecha_pedido)}`, margen, 46)
  if (orden.fecha_vencimiento) {
    doc.text(`Vencimiento: ${formatearFecha(orden.fecha_vencimiento)}`, margen, 52)
  }

  const proveedoresUnicos = [
    ...new Set(
      orden.items
        .map((i) => i.proveedor_nombre?.trim())
        .filter((n): n is string => Boolean(n))
    ),
  ]
  if (proveedoresUnicos.length === 1) {
    const item = orden.items.find((i) => i.proveedor_nombre)
    doc.text(`Proveedor: ${item?.proveedor_nombre ?? ''}`, margen, 58)
    if (item?.proveedor_nit) doc.text(`NIT: ${item.proveedor_nit}`, margen, 64)
    if (item?.proveedor_email) doc.text(`Email: ${item.proveedor_email}`, margen, 70)
  } else if (proveedoresUnicos.length > 1) {
    doc.text('Proveedores: varios (ver detalle por línea)', margen, 58)
  }

  const inicioTabla = proveedoresUnicos.length <= 1 && orden.items[0]?.proveedor_email ? 76 : 62

  autoTable(doc, {
    startY: inicioTabla,
    head: [
      [
        '#',
        'Código',
        'Descripción',
        'Proveedor',
        'NIT',
        'Cant.',
        'Recibido',
        'Obs.',
      ],
    ],
    body: orden.items.map((item, idx) => [
      String(idx + 1),
      item.codigo_producto,
      item.descripcion,
      item.proveedor_nombre ?? '',
      item.proveedor_nit ?? '',
      String(item.cantidad),
      item.cantidad_recibida != null ? String(item.cantidad_recibida) : '',
      item.observaciones ?? '',
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 65, 114], textColor: 255 },
    margin: { left: margen, right: margen },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? inicioTabla + 40

  let y = finalY + 8
  if (orden.observaciones?.trim()) {
    doc.setFont('helvetica', 'bold')
    doc.text('Notas:', margen, y)
    doc.setFont('helvetica', 'normal')
    const lineas = doc.splitTextToSize(orden.observaciones.trim(), 180)
    doc.text(lineas, margen, y + 5)
    y += 5 + lineas.length * 4
  }

  if (orden.observaciones_entrega?.trim()) {
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.text('Seguimiento de entregas:', margen, y)
    doc.setFont('helvetica', 'normal')
    const lineas = doc.splitTextToSize(orden.observaciones_entrega.trim(), 180)
    doc.text(lineas, margen, y + 5)
  }

  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(
    'Documento generado desde el panel — cargar en Siigo Nube según procedimiento interno.',
    margen,
    270
  )

  return doc
}

export function descargarPdfOrdenCompra(orden: OrdenCompra, nombreArchivo?: string) {
  const doc = generarPdfOrdenCompra(orden)
  const slug = tituloOrdenDisplay(orden)
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)
  doc.save(nombreArchivo ?? `${slug || `oc-${orden.id}`}.pdf`)
}
