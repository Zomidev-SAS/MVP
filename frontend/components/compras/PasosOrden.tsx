import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resumenRecepcion, type OrdenCompra } from '@/lib/types/orden-compra'

type EstadoPaso = 'hecho' | 'actual' | 'pendiente'

interface Paso {
  titulo: string
  detalle: string
  estado: EstadoPaso
}

function pasosDe(orden: OrdenCompra): Paso[] {
  const recibidas = orden.items.reduce((a, i) => a + Number(i.cantidad_recibida ?? 0), 0)
  const completas = orden.items.length > 0 && orden.items.every((i) => resumenRecepcion(i).completa)
  const parcial = recibidas > 0 && !completas
  const finalizada = orden.estado === 'listo'
  const requiereFirma = Boolean(orden.documento_path)
  const firmada = Boolean(orden.firmada_at)

  const pasos: Paso[] = [{ titulo: 'Creada', detalle: 'Orden registrada', estado: 'hecho' }]

  if (requiereFirma) {
    pasos.push({
      titulo: 'Firmada',
      detalle: firmada ? 'Aprobada por el administrador' : 'Espera la firma',
      estado: firmada ? 'hecho' : 'actual',
    })
  }

  pasos.push({
    titulo: 'Entregas',
    detalle: completas ? 'Todo recibido' : parcial ? 'Entrega parcial' : 'Sin recibir',
    estado: completas ? 'hecho' : parcial || (!requiereFirma || firmada) ? 'actual' : 'pendiente',
  })

  pasos.push({
    titulo: 'Finalizada',
    detalle: finalizada ? 'Orden cerrada' : 'Pendiente',
    estado: finalizada ? 'hecho' : completas ? 'actual' : 'pendiente',
  })

  return pasos
}

/** Recorrido de la orden: creada → firmada → entregas → finalizada. */
export function PasosOrden({ orden }: { orden: OrdenCompra }) {
  if (orden.estado === 'cancelada') {
    return (
      <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        Esta orden fue cancelada.
      </p>
    )
  }

  const pasos = pasosDe(orden)

  return (
    <ol className="flex items-start" aria-label="Avance de la orden">
      {pasos.map((paso, i) => (
        <li key={paso.titulo} className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors',
                paso.estado === 'hecho' && 'border-primary bg-primary text-primary-foreground',
                paso.estado === 'actual' && 'animate-pulse border-amber-500 bg-amber-100 text-amber-800',
                paso.estado === 'pendiente' && 'border-muted-foreground/30 bg-background text-muted-foreground'
              )}
            >
              {paso.estado === 'hecho' ? <Check aria-hidden className="h-3.5 w-3.5" /> : i + 1}
            </span>
            {i < pasos.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'mx-1 h-0.5 flex-1 rounded-full transition-colors',
                  paso.estado === 'hecho' ? 'bg-primary' : 'bg-muted-foreground/20'
                )}
              />
            )}
          </div>
          <p className={cn('mt-1.5 text-xs font-semibold', paso.estado === 'pendiente' && 'text-muted-foreground')}>
            {paso.titulo}
          </p>
          <p className="pr-1 text-[11px] leading-tight text-muted-foreground">{paso.detalle}</p>
        </li>
      ))}
    </ol>
  )
}
