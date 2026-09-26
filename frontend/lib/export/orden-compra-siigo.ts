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
    'Cantidad recibida',
    'Observaciones ítem',
    'Referencia panel',
  ]

  const filas: string[] = []
  for (const oc of ordenes) {
    for (const item of oc.items) {
      filas.push(
        [
          oc.fecha_pedido,
          item.proveedor_nit ?? '',
          item.proveedor_nombre ?? '',
          item.proveedor_email ?? '',
          item.codigo_producto,
          item.descripcion,
          item.cantidad,
          item.cantidad_recibida ?? '',
          item.observaciones ?? '',
          `OC-PANEL-${oc.id}`,
        ]
          .map(escCsv)
          .join(',')
      )
    }
  }

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
