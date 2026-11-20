export interface ItemOrdenPlanta {
  codigo_producto: string
  nombre_producto: string | null
  descripcion: string
  cantidad: number
  cantidad_recibida: number
  proveedor_nombre: string | null
  observaciones: string | null
}

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
  titulo: string | null
  observaciones: string | null
  items: ItemOrdenPlanta[]
}

export interface OrdenFinalizadaPlanta {
  id: number
  numero: string | null
  titulo: string | null
  proveedor: string | null
  finalizada_at: string
  /** Fecha de cierre escrita o elegida en la orden (migración 079). */
  fecha_cierre?: string | null
  pedidas: number
  recibidas: number
  lineas: number
}

export interface KpisPlantaCompras {
  en_curso: number
  /** Órdenes finalizadas en los últimos 30 días (migración 077; antes no venía). */
  finalizadas_30d: number
  pendientes_firma: number
  con_entregas_parciales: number
}

export interface DatosPlantaCompras {
  kpis: KpisPlantaCompras
  ordenes: OrdenPlanta[]
  /** Últimas órdenes finalizadas, la más reciente primero. */
  finalizadas: OrdenFinalizadaPlanta[]
}
