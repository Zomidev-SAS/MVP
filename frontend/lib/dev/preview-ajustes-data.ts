import type { AjustePendiente } from '@/lib/types/ajustes'

export function getDevPreviewAjustesData(): AjustePendiente[] {
  const baseDate = new Date('2026-08-28T00:00:00Z')
  const motivos = [
    'Discrepancia con conteo físico',
    'Producto dañado en bodega',
    'Corrección de registro duplicado',
    'Ajuste por devolución',
    'Diferencia en auditoría',
  ]

  return Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    vin: `VIN-${(3000 + i).toString()}`,
    cantidad: i % 2 === 0 ? -(i + 1) : i + 1,
    motivo: motivos[i],
    solicitado_por: `b0000000-0000-0000-0000-00000000000${i}`,
    created_at: new Date(baseDate.getTime() + i * 4 * 60 * 60 * 1000).toISOString(),
  }))
}
