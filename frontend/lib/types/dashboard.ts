export interface MovimientoReciente {
  id: number
  vin: string
  tipo_movimiento: 'entrada' | 'salida_vin' | 'ajuste' | 'reverso'
  cantidad: number
  actor_nombre: string | null
  created_at: string
}

export interface EntradaSalidaDia {
  fecha: string
  entradas: number
  salidas: number
}

export interface DashboardData {
  totalUnidades: number
  valorTotal: number
  movimientosHoy: number
  stockBajo: number
  entradasVsSalidas: EntradaSalidaDia[]
  ultimosMovimientos: MovimientoReciente[]
}
