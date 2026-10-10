import type { CalendarEvento } from '@/lib/types/calendario'

const DAY_MS = 24 * 60 * 60 * 1000

function toFechaKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function getDevPreviewCalendarioData(): CalendarEvento[] {
  const hoy = new Date()
  const manana = new Date(hoy.getTime() + DAY_MS)
  const enTresDias = new Date(hoy.getTime() + 3 * DAY_MS)

  return [
    {
      id: 1,
      fecha: toFechaKey(manana),
      fecha_fin: null,
      titulo: 'Reunión con proveedor',
      nota: 'Confirmar cantidades antes de la reunión. Llevar listado de faltantes.',
      secciones: [
        { id: 1, titulo: 'Imprimir reporte de inventario', completada: true, orden: 0 },
        { id: 2, titulo: 'Confirmar hora con bodega', completada: false, orden: 1 },
      ],
      fechas_adicionales: [],
    },
    {
      id: 2,
      fecha: toFechaKey(hoy),
      fecha_fin: toFechaKey(enTresDias),
      titulo: 'Corte de inventario mensual',
      nota: 'Conteo físico en todas las bodegas.',
      secciones: [
        { id: 3, titulo: 'Bodega principal', completada: false, orden: 0 },
        { id: 4, titulo: 'Bodega secundaria', completada: false, orden: 1 },
      ],
      fechas_adicionales: [],
    },
    {
      id: 3,
      fecha: toFechaKey(hoy),
      fecha_fin: null,
      titulo: 'Entrega de repuestos',
      nota: 'Recoger en bodega principal.',
      secciones: [],
      fechas_adicionales: [toFechaKey(new Date(hoy.getTime() + 7 * DAY_MS))],
    },
    {
      id: 4,
      fecha: toFechaKey(new Date(hoy.getTime() + 7 * DAY_MS)),
      fecha_fin: null,
      titulo: 'Auditoría interna',
      nota: null,
      secciones: [],
      fechas_adicionales: [],
    },
  ]
}
