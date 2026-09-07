import type { InventarioItem } from '@/lib/types/inventario'

const MARCAS = ['Toyota', 'Chevrolet', 'Renault', 'Mazda']
const CATEGORIAS = ['Transformaciones', 'Componentes', 'Accesorios', 'Otros']
const UBICACIONES = ['Bodega Principal', 'Bodega Norte', 'Patio Exhibicion']

export function getDevPreviewInventarioData(): InventarioItem[] {
  const baseDate = new Date('2026-08-01T00:00:00Z')

  return Array.from({ length: 120 }, (_, i) => {
    const marca = MARCAS[i % MARCAS.length]
    const categoria = CATEGORIAS[i % CATEGORIAS.length]
    const ubicacion = UBICACIONES[i % UBICACIONES.length]
    const saldo = i % 15
    const valorUnitario = 5_000_000 + (i % 10) * 250_000
    const ultimoMovimiento = new Date(baseDate.getTime() + i * 6 * 60 * 60 * 1000).toISOString()

    return {
      vin: `VIN-${(2000 + i).toString()}`,
      marca,
      categoria,
      ubicacion,
      saldo,
      valor_unitario: valorUnitario,
      valor_total: saldo * valorUnitario,
      ultimo_movimiento: ultimoMovimiento,
    }
  })
}
