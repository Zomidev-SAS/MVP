import type { DashboardData, MovimientoReciente } from '@/lib/types/dashboard'

const TIPOS: MovimientoReciente['tipo_movimiento'][] = [
  'entrada',
  'salida_vin',
  'ajuste',
  'entrada',
  'salida_vin',
]

const ACTORES = ['Juan Pérez', 'María Gómez', 'Carlos Ruiz']

export function getDevPreviewDashboardData(): DashboardData {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const entradasVsSalidas = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return {
      fecha: d.toISOString().slice(0, 10),
      entradas: 15 + ((i * 7) % 20),
      salidas: 10 + ((i * 5) % 15),
    }
  })

  const ultimosMovimientos: MovimientoReciente[] = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    vin: `VIN-${(1000 + i).toString()}`,
    tipo_movimiento: TIPOS[i % TIPOS.length],
    cantidad: 5 + i,
    actor_nombre: ACTORES[i % ACTORES.length],
    created_at: new Date(today.getTime() - i * 3 * 60 * 60 * 1000).toISOString(),
  }))

  return {
    totalUnidades: 12455,
    valorTotal: 3246780000,
    movimientosHoy: 42,
    stockBajo: 7,
    entradasVsSalidas,
    ultimosMovimientos,
  }
}
