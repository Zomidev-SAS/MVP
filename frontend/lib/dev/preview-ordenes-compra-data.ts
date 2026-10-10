import type { OrdenCompra, OrdenCompraItem } from '@/lib/types/orden-compra'

const ITEM_BASE: Omit<OrdenCompraItem, 'id' | 'orden_id'> = {
  codigo_producto: 'PROD-001',
  nombre_producto: 'Producto demo 1',
  cantidad: 10,
  cantidad_recibida: null,
  descripcion: 'Repuesto urgente — stock bajo',
  proveedor_nit: '900123456',
  proveedor_nombre: 'COAUTOPARTES',
  proveedor_email: 'compras@coautopartes.com',
  observaciones: null,
  orden_linea: 1,
}

let store: OrdenCompra[] = [
  {
    id: 1,
    titulo: 'COAUTOPARTES OC 3674',
    fecha_pedido: new Date().toISOString().slice(0, 10),
    fecha_vencimiento: null,
    estado: 'en_curso',
    observaciones: 'Pedido urgente para línea de producción',
    observaciones_entrega: null,
    creado_por: 'dev-preview-user',
    descargada_siigo_at: null,
    finalizada_at: null,
    siigo_referencia: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [{ ...ITEM_BASE, id: 1, orden_id: 1 }],
    codigo_producto: ITEM_BASE.codigo_producto,
    descripcion: ITEM_BASE.descripcion,
    cantidad: ITEM_BASE.cantidad,
    proveedor_nombre: ITEM_BASE.proveedor_nombre,
  },
  {
    id: 2,
    titulo: 'FERREPLASTICOS OC 3213',
    fecha_pedido: new Date().toISOString().slice(0, 10),
    fecha_vencimiento: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    estado: 'listo',
    observaciones: null,
    observaciones_entrega: 'PEDIDO ENTREGADO COMPLETO',
    creado_por: 'dev-preview-user',
    descargada_siigo_at: new Date().toISOString(),
    finalizada_at: new Date().toISOString(),
    siigo_referencia: 'OC3213',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      {
        id: 2,
        orden_id: 2,
        codigo_producto: 'TOR-100',
        nombre_producto: 'Tornillo M8',
        cantidad: 1000,
        cantidad_recibida: 1000,
        descripcion: 'Tornillo M8 x 25mm',
        proveedor_nit: '800111222',
        proveedor_nombre: 'FERREPLASTICOS',
        proveedor_email: '',
        observaciones: null,
        orden_linea: 1,
      },
    ],
    codigo_producto: 'TOR-100',
    descripcion: 'Tornillo M8 x 25mm',
    cantidad: 1000,
    proveedor_nombre: 'FERREPLASTICOS',
  },
]

function enriquecerLegacy(orden: OrdenCompra): OrdenCompra {
  const primero = orden.items[0]
  return {
    ...orden,
    codigo_producto: primero?.codigo_producto ?? null,
    nombre_producto: primero?.nombre_producto ?? null,
    cantidad: primero?.cantidad ?? null,
    descripcion: primero?.descripcion ?? null,
    proveedor_nit: primero?.proveedor_nit ?? null,
    proveedor_nombre: primero?.proveedor_nombre ?? null,
  }
}

export function getDevPreviewOrdenesCompra(codigoProducto?: string): OrdenCompra[] {
  let lista = [...store]
  if (codigoProducto) {
    lista = lista.filter((o) => o.items.some((i) => i.codigo_producto === codigoProducto))
  }
  return lista.sort((a, b) => b.created_at.localeCompare(a.created_at)).map(enriquecerLegacy)
}

export function getDevPreviewOrdenById(id: number): OrdenCompra | null {
  const orden = store.find((o) => o.id === id)
  return orden ? enriquecerLegacy(orden) : null
}

export function getDevPreviewOrdenesPendientesCount(): number {
  return store.filter((o) => o.estado === 'en_curso').length
}

export function devPreviewInsertOrden(
  datos: Omit<OrdenCompra, 'id' | 'created_at' | 'updated_at' | 'creado_por' | 'items'> & {
    items: Omit<OrdenCompraItem, 'id' | 'orden_id'>[]
  }
): OrdenCompra {
  const id = store.length > 0 ? Math.max(...store.map((o) => o.id)) + 1 : 1
  const items: OrdenCompraItem[] = datos.items.map((item, idx) => ({
    ...item,
    id: id * 100 + idx + 1,
    orden_id: id,
    orden_linea: idx + 1,
  }))
  const nueva: OrdenCompra = {
    ...datos,
    id,
    items,
    creado_por: 'dev-preview-user',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  store = [...store, nueva]
  return enriquecerLegacy(nueva)
}

export function devPreviewUpdateOrden(id: number, patch: Partial<OrdenCompra>): OrdenCompra | null {
  const idx = store.findIndex((o) => o.id === id)
  if (idx === -1) return null
  const actualizada = enriquecerLegacy({
    ...store[idx],
    ...patch,
    updated_at: new Date().toISOString(),
  })
  store = store.map((o) => (o.id === id ? actualizada : o))
  return actualizada
}

export function devPreviewDeleteOrden(id: number): boolean {
  const antes = store.length
  store = store.filter((o) => o.id !== id)
  return store.length < antes
}
