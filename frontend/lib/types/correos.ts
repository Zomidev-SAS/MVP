// frontend/lib/types/correos.ts
export type EstadoCorreo = 'pendiente' | 'enviado' | 'error'
export type OrigenCorreo = 'alerta' | 'mensaje'

export interface CorreoEnviado {
  id: string
  destinatarioEmail: string
  destinatarioNombre: string
  rolDestino: string
  asunto: string
  origen: OrigenCorreo
  estado: EstadoCorreo
  fechaEnvio: string | null
  error: string | null
  creadoEn: string
}

export interface EnvioPreview {
  rol: string
  totalDestinatarios: number
}
