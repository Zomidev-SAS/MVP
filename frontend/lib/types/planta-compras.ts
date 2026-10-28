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

export interface KpisPlantaCompras {
  en_curso: number
  vencidas: number
  pendientes_firma: number
  con_entregas_parciales: number
}

export interface DatosPlantaCompras {
  kpis: KpisPlantaCompras
  ordenes: OrdenPlanta[]
}
