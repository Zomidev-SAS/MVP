// frontend/lib/types/dashboard-graficas.ts
export interface IndicadorKpi {
  id: string
  etiqueta: string
  valor: number
  unidad: 'unidades' | 'cop' | 'porcentaje' | 'dias'
  variacionPct: number | null // vs periodo anterior; null si no hay dato previo
}

export interface StockPorBodegaPunto {
  bodega: string
  cantidad: number
}

export interface StockPorCategoriaPunto {
  categoria: string
  cantidad: number
}

export interface TopProductoPunto {
  producto: string
  cantidad: number
}

export interface VehiculoPorEtapaPunto {
  etapa: string
  cantidad: number
  tiempoPromedioDias: number
}

export interface AjusteOCPorEstadoPunto {
  tipo: 'ajuste' | 'orden_compra'
  estado: string
  cantidad: number
}

export interface ValorizacionPunto {
  fecha: string // ISO date
  valorCop: number
}

export type RangoFecha = 'hoy' | '7d' | '30d' | '90d' | 'personalizado'

export interface DashboardFiltros {
  rango: RangoFecha
  desde?: string // ISO date, solo si rango === 'personalizado'
  hasta?: string
  bodegaId?: string
  categoriaId?: string
}

export interface DashboardGraficasPayload {
  kpis: IndicadorKpi[]
  entradasSalidas: { fecha: string; entradas: number; salidas: number }[]
  stockPorBodega: StockPorBodegaPunto[]
  stockPorCategoria: StockPorCategoriaPunto[]
  topProductos: TopProductoPunto[]
  vehiculosPorEtapa: VehiculoPorEtapaPunto[]
  ajustesOCPorEstado: AjusteOCPorEstadoPunto[]
  valorizacion: ValorizacionPunto[] | null // null si el rol no ve costos
}
