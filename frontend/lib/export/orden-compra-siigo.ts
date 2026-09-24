import type { OrdenCompra } from '@/lib/types/orden-compra'

function escCsv(valor: string | number | null | undefined): string {
  if (valor == null) return '""'
  return `"${String(valor).replace(/"/g, '""')}"`
}

/** CSV para cargar manualmente la OC en Siigo Nube (una fila por ítem). */
export function generarCsvSiigo(ordenes: OrdenCompra[]): string {
  const encabezados = [
    'Fecha elaboración',
    'Proveedor NIT',
    'Proveedor nombre',
    'Proveedor email',
    'Código producto',
    'Descripción pedido',
    'Cantidad',
    'Observaciones',
    'Referencia panel',
  ]

  const filas = ordenes.map((oc) =>
    [
      oc.fecha_pedido,
      oc.proveedor_nit ?? '',
      oc.proveedor_nombre ?? '',
      oc.proveedor_email ?? '',
      oc.codigo_producto,
      oc.descripcion,
      oc.cantidad,
      oc.observaciones ?? '',
      `OC-PANEL-${oc.id}`,
    ]
      .map(escCsv)
      .join(',')
  )

  return [encabezados.join(','), ...filas].join('\n')
}

export function descargarCsvSiigo(ordenes: OrdenCompra[], nombreArchivo?: string) {
  const csv = generarCsvSiigo(ordenes)
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  const ref = ordenes.length === 1 ? `oc-${ordenes[0].id}` : `oc-lote-${Date.now()}`
  enlace.download = nombreArchivo ?? `${ref}-siigo.csv`
  enlace.click()
  URL.revokeObjectURL(url)
}
