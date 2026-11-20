// frontend/lib/types/actividad.ts
export interface EventoActividad {
  id: string
  actorNombre: string
  accion: string // "creó ajuste", "aprobó OC", etc.
  recurso: string // tabla/entidad afectada
  recursoId: string | null
  bodega: string | null
  creadoEn: string
}
