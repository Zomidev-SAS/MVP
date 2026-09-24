import type { OrdenCompra } from '@/lib/types/orden-compra'

const BASE: Omit<OrdenCompra, 'id' | 'codigo_producto' | 'nombre_producto' | 'descripcion'> = {
  fecha_pedido: new Date().toISOString().slice(0, 10),
  cantidad: 10,
  proveedor_nit: '900123456',
  proveedor_nombre: 'Proveedor Demo S.A.S.',
  proveedor_email: 'compras@proveedor-demo.com',
  destino_envio: 'compras',
  estado: 'borrador',
  observaciones: null,
  creado_por: 'dev-preview-user',
  enviado_a_compras_at: null,
  enviado_a_proveedor_at: null,
  descargada_siigo_at: null,
  finalizada_at: null,
  siigo_referencia: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

let store: OrdenCompra[] = [
  {
    ...BASE,
    id: 1,
    codigo_producto: 'PROD-001',
    nombre_producto: 'Producto demo 1',
    descripcion: 'Repuesto urgente — stock bajo',
    estado: 'enviada',
    enviado_a_compras_at: new Date().toISOString(),
  },
]

export function getDevPreviewOrdenesCompra(codigoProducto?: string): OrdenCompra[] {
  const lista = codigoProducto
    ? store.filter((o) => o.codigo_producto === codigoProducto)
    : [...store]
  return lista.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getDevPreviewOrdenesPendientesCount(): number {
  return store.filter((o) => o.estado === 'enviada').length
}

export function devPreviewInsertOrden(
  datos: Omit<OrdenCompra, 'id' | 'created_at' | 'updated_at' | 'creado_por'>
): OrdenCompra {
  const nueva: OrdenCompra = {
    ...datos,
    id: store.length > 0 ? Math.max(...store.map((o) => o.id)) + 1 : 1,
    creado_por: 'dev-preview-user',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  store = [...store, nueva]
  return nueva
}

export function devPreviewUpdateOrden(id: number, patch: Partial<OrdenCompra>): OrdenCompra | null {
  const idx = store.findIndex((o) => o.id === id)
  if (idx === -1) return null
  const actualizada = { ...store[idx], ...patch, updated_at: new Date().toISOString() }
  store = store.map((o) => (o.id === id ? actualizada : o))
  return actualizada
}

export function devPreviewDeleteOrden(id: number): boolean {
  const antes = store.length
  store = store.filter((o) => o.id !== id)
  return store.length < antes
}
