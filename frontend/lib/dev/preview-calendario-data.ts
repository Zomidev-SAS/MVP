import type { CalendarEvento } from '@/lib/types/calendario'

const DAY_MS = 24 * 60 * 60 * 1000

function toFechaKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function getDevPreviewCalendarioData(): CalendarEvento[] {
  const hoy = new Date()
  const offsets = [1, 3, -2, 7]
  const titulos = [
    'Reunión con proveedor',
    'Corte de inventario mensual',
    'Entrega de repuestos',
    'Auditoría interna',
  ]
  const notas: (string | null)[] = [
    'Confirmar cantidades antes de la reunión',
    null,
    'Recoger en bodega principal',
    null,
  ]

  return offsets.map((offset, i) => ({
    id: i + 1,
    fecha: toFechaKey(new Date(hoy.getTime() + offset * DAY_MS)),
    titulo: titulos[i],
    nota: notas[i],
  }))
}
