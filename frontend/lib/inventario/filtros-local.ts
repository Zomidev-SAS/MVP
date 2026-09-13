import type { InventarioFiltros, InventarioItem } from '@/lib/types/inventario'

export function filtrarInventarioLocal(
  filas: InventarioItem[],
  filtros: InventarioFiltros
): InventarioItem[] {
  return filas.filter((item) => coincideFiltros(item, filtros))
}

function coincideFiltros(item: InventarioItem, filtros: InventarioFiltros): boolean {
  if (filtros.busqueda.trim()) {
    const q = normalizar(filtros.busqueda)
    const blob = normalizar(
      [item.codigo, item.nombre, item.vin, item.marca, item.categoria, item.ubicacion]
        .filter(Boolean)
        .join(' ')
    )
    const tokens = q.split(/\s+/).filter(Boolean)
    if (!tokens.every((t) => blob.includes(t))) return false
  }

  if (filtros.vin.trim()) {
    const codigo = normalizar(item.codigo)
    const vin = normalizar(item.vin ?? '')
    const q = normalizar(filtros.vin)
    if (codigo !== q && !codigo.includes(q) && vin !== q) return false
  }

  if (filtros.marca.trim()) {
    const q = normalizar(filtros.marca)
    const campos = [item.marca, item.nombre].map((v) => normalizar(v ?? ''))
    if (!campos.some((c) => c.includes(q))) return false
  }

  if (filtros.categoria.trim()) {
    if (!normalizar(item.categoria ?? '').includes(normalizar(filtros.categoria))) return false
  }

  if (filtros.ubicacion.trim()) {
    if (!normalizar(item.ubicacion ?? '').includes(normalizar(filtros.ubicacion))) return false
  }

  if (filtros.estado === 'activo' && item.saldo <= 0) return false
  if (filtros.estado === 'agotado' && item.saldo > 0) return false

  if (filtros.desde && item.ultimo_movimiento && item.ultimo_movimiento < filtros.desde) {
    return false
  }
  if (filtros.hasta && item.ultimo_movimiento && item.ultimo_movimiento > filtros.hasta) {
    return false
  }

  return true
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}
