// frontend/lib/dev/preview-correos-data.ts
import type { CorreoEnviado } from '@/lib/types/correos'

export const PREVIEW_CORREOS: CorreoEnviado[] = [
  {
    id: 'c1',
    destinatarioEmail: 'compras@carreraarango.com',
    destinatarioNombre: 'Ana Torres',
    rolDestino: 'compras',
    asunto: 'Stock bajo: 3 productos',
    origen: 'alerta',
    estado: 'enviado',
    fechaEnvio: new Date().toISOString(),
    error: null,
    creadoEn: new Date().toISOString(),
  },
  {
    id: 'c2',
    destinatarioEmail: 'supervisor@carreraarango.com',
    destinatarioNombre: 'Jorge Lema',
    rolDestino: 'supervisor',
    asunto: 'Nuevo mensaje interno',
    origen: 'mensaje',
    estado: 'error',
    fechaEnvio: null,
    error: 'Dirección de correo rechazada por el servidor.',
    creadoEn: new Date().toISOString(),
  },
]
