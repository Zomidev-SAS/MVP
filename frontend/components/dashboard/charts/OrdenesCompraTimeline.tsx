import { CalendarClock } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import {
  CLASE_ESTADO_OC,
  ETIQUETA_ESTADO_OC,
  type EventoLineaTiempoOrden,
  type OrdenLineaTiempo,
  type TipoEventoOrden,
} from '@/lib/types/orden-compra'

const ETIQUETA_EVENTO: Record<TipoEventoOrden, string> = {
  inicio: 'Inicio',
  parcial: 'Entrega parcial',
  fin: 'Finalización',
  cancelada: 'Cancelada',
}

const COLOR_PUNTO: Record<TipoEventoOrden, string> = {
  inicio: 'bg-primary',
  parcial: 'bg-amber-500',
  fin: 'bg-emerald-600',
  cancelada: 'bg-muted-foreground',
}

function formatearFecha(valor: string): string {
  // Las fechas de pedido llegan como YYYY-MM-DD: se fija el mediodía para que
  // la zona horaria no las corra un día.
  const d = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor)
  if (Number.isNaN(d.getTime())) return '—'
  const conHora = valor.length > 10
  return d.toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

function numero(n: number): string {
  return n.toLocaleString('es-CO', { maximumFractionDigits: 2 })
}

function Hito({
  evento,
  ultimo,
}: {
  evento: EventoLineaTiempoOrden
  ultimo: boolean
}) {
  return (
    <li className="flex min-w-[140px] flex-1 flex-col">
      <div className="flex items-center">
        <span
          aria-hidden
          className={cn('h-3 w-3 shrink-0 rounded-full ring-4 ring-background', COLOR_PUNTO[evento.tipo])}
        />
        {!ultimo && <span aria-hidden className="h-0.5 flex-1 bg-border" />}
      </div>
      <p className="mt-2 text-xs font-semibold text-foreground">{ETIQUETA_EVENTO[evento.tipo]}</p>
      <p className="text-xs text-muted-foreground">{formatearFecha(evento.fecha)}</p>
      {evento.tipo === 'parcial' && (
        <p className="mt-0.5 pr-2 text-xs text-foreground">{evento.detalle}</p>
      )}
    </li>
  )
}

function HitoPendiente() {
  return (
    <li className="flex min-w-[140px] flex-1 flex-col">
      <div className="flex items-center">
        <span
          aria-hidden
          className="h-3 w-3 shrink-0 rounded-full border-2 border-dashed border-muted-foreground bg-background"
        />
      </div>
      <p className="mt-2 text-xs font-semibold text-muted-foreground">Finalización</p>
      <p className="text-xs text-muted-foreground">Pendiente</p>
    </li>
  )
}

export function OrdenesCompraTimeline({ ordenes }: { ordenes: OrdenLineaTiempo[] }) {
  if (ordenes.length === 0) {
    return <EmptyState icon={CalendarClock} title="Aún no hay órdenes de compra" />
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Órdenes de compra: inicio, entregas parciales y finalización</h3>
      <ul className="space-y-3">
        {ordenes.map((orden) => {
          const enCurso = orden.estado === 'en_curso'
          return (
            <li key={orden.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{orden.titulo}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    Recibido {numero(orden.recibidas)} de {numero(orden.pedidas)}
                  </span>
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs font-semibold',
                      CLASE_ESTADO_OC[orden.estado]
                    )}
                  >
                    {ETIQUETA_ESTADO_OC[orden.estado]}
                  </span>
                </div>
              </div>
              <ol className="mt-3 flex items-start overflow-x-auto pb-1">
                {orden.eventos.map((evento, indice) => (
                  <Hito
                    key={`${evento.tipo}-${indice}`}
                    evento={evento}
                    ultimo={!enCurso && indice === orden.eventos.length - 1}
                  />
                ))}
                {enCurso && <HitoPendiente />}
              </ol>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
