import type { ProductoBajoStock } from '@/components/dashboard/LowStockList'

export interface OrdenPlanta {
  id: number
  numero: string | null
  proveedor: string | null
  fecha_pedido: string
  fecha_vencimiento: string | null
  requiere_firma: boolean
  firmada: boolean
  pedidas: number
  recibidas: number
  ultima_entrega: string | null
}

export interface KpisPlantaCompras {
  en_curso: number
  vencidas: number
  pendientes_firma: number
  con_entregas_parciales: number
}

export interface DatosPlantaCompras {
  kpis: KpisPlantaCompras
  ordenes: OrdenPlanta[]
  productosStockBajo: ProductoBajoStock[]
}
