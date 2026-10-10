export interface ProductoStockBajo {
  codigo_producto: string
  nombre_producto: string | null
  saldo: number
}

export interface EstadoCorreoNotificacion {
  enviado: boolean
  fecha: string | null
}

export interface AlertaStockBajo {
  tipo: 'stock_bajo'
  id: string
  titulo: string
  resumen: string
  href: string
  productos: ProductoStockBajo[]
  correoEnviado?: EstadoCorreoNotificacion
}

export interface AlertaAjustes {
  tipo: 'ajustes_pendientes'
  id: string
  titulo: string
  resumen: string
  href: string
  cantidad: number
  correoEnviado?: EstadoCorreoNotificacion
}

export interface EventoHoyResumen {
  id: number
  titulo: string
  fecha: string
  fecha_fin: string | null
  nota: string | null
}

export interface AlertaEventosHoy {
  tipo: 'eventos_hoy'
  id: string
  titulo: string
  resumen: string
  href: string
  eventos: EventoHoyResumen[]
  correoEnviado?: EstadoCorreoNotificacion
}

export interface OrdenCompraPendienteResumen {
  id: number
  codigo_producto: string
  descripcion: string
  cantidad: number
  fecha_pedido: string
}

export interface AlertaOrdenesCompra {
  tipo: 'ordenes_compra'
  id: string
  titulo: string
  resumen: string
  href: string
  ordenes: OrdenCompraPendienteResumen[]
  correoEnviado?: EstadoCorreoNotificacion
}

export type AlertaNotificacion =
  | AlertaStockBajo
  | AlertaAjustes
  | AlertaEventosHoy
  | AlertaOrdenesCompra

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
