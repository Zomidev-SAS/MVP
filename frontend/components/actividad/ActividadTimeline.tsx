import { Boxes, ClipboardCheck, FileEdit, Package, User } from 'lucide-react'
import type { EventoActividad } from '@/lib/types/actividad'

const ICONO_POR_RECURSO: Record<string, typeof Boxes> = {
  ajustes_pendientes: FileEdit,
  ordenes_compra: ClipboardCheck,
  movimientos_inventario: Package,
  profiles: User,
}

export function ActividadTimeline({ eventos }: { eventos: EventoActividad[] }) {
  if (eventos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
  }
  return (
    <ol className="space-y-3">
      {eventos.map((evento) => {
        const Icono = ICONO_POR_RECURSO[evento.recurso] ?? Boxes
        return (
          <li key={evento.id} className="flex gap-3 border-l-2 border-border pl-4">
            <Icono className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="text-sm">
              <p>
                <span className="font-medium">{evento.actorNombre}</span> {evento.accion}
                {evento.bodega && <span className="text-muted-foreground"> · {evento.bodega}</span>}
              </p>
              <p className="text-xs text-muted-foreground">{new Date(evento.creadoEn).toLocaleString('es-CO')}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
