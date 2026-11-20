import type { EventoActividad } from '@/lib/types/actividad'

export const PREVIEW_ACTIVIDAD: EventoActividad[] = Array.from({ length: 20 }).map((_, i) => ({
  id: `evt-${i}`,
  actorNombre: ['Juan Pérez', 'Laura Gómez', 'Carlos Ruiz'][i % 3],
  accion: ['creó ajuste', 'aprobó orden de compra', 'registró movimiento', 'editó usuario'][i % 4],
  recurso: ['ajustes_pendientes', 'ordenes_compra', 'movimientos_inventario', 'profiles'][i % 4],
  recursoId: `rec-${i}`,
  bodega: ['Principal', 'Taller', null][i % 3],
  creadoEn: new Date(Date.now() - i * 15 * 60_000).toISOString(),
}))
