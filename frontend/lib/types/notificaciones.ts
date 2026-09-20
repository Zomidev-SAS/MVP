export interface ProductoStockBajo {
  codigo_producto: string
  nombre_producto: string | null
  saldo: number
}

export interface AlertaStockBajo {
  tipo: 'stock_bajo'
  id: string
  titulo: string
  resumen: string
  href: string
  productos: ProductoStockBajo[]
}

export interface AlertaAjustes {
  tipo: 'ajustes_pendientes'
  id: string
  titulo: string
  resumen: string
  href: string
  cantidad: number
}

export type AlertaNotificacion = AlertaStockBajo | AlertaAjustes

export interface MensajePanel {
  id: number
  titulo: string
  cuerpo: string
  nivel: 'info' | 'aviso' | 'urgente'
  rol_destino: string | null
  created_at: string
  leido: boolean
}

export interface NotificacionesPayload {
  alertas: AlertaNotificacion[]
  mensajes: MensajePanel[]
  totalSinLeer: number
}
