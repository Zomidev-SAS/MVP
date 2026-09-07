'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCOP, formatNumber } from '@/lib/format'
import type { MovimientoDetalle } from '@/lib/types/movimientos'

const TIPO_LABELS: Record<MovimientoDetalle['tipo_movimiento'], string> = {
  entrada: 'Entrada',
  salida_vin: 'Salida',
  ajuste: 'Ajuste',
  reverso: 'Reverso',
}

const ESTADO_LABELS: Record<MovimientoDetalle['estado'], string> = {
  pendiente: 'Pendiente',
  aplicado: 'Aplicado',
  rechazado: 'Rechazado',
}

export function MovementDetailDialog({
  movimiento,
  open,
  onOpenChange,
}: {
  movimiento: MovimientoDetalle | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalle del movimiento</DialogTitle>
        </DialogHeader>
        {movimiento && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">VIN</dt>
            <dd>{movimiento.vin}</dd>
            <dt className="text-muted-foreground">Tipo</dt>
            <dd>{TIPO_LABELS[movimiento.tipo_movimiento]}</dd>
            <dt className="text-muted-foreground">Estado</dt>
            <dd>{ESTADO_LABELS[movimiento.estado]}</dd>
            <dt className="text-muted-foreground">Cantidad</dt>
            <dd>{formatNumber(movimiento.cantidad)}</dd>
            <dt className="text-muted-foreground">Valor Unitario</dt>
            <dd>{movimiento.valor_unitario ? formatCOP(movimiento.valor_unitario) : '—'}</dd>
            <dt className="text-muted-foreground">Ubicación</dt>
            <dd>{movimiento.ubicacion ?? '—'}</dd>
            <dt className="text-muted-foreground">Usuario</dt>
            <dd>{movimiento.actor_nombre ?? '—'}</dd>
            <dt className="text-muted-foreground">Aprobado por</dt>
            <dd className="truncate">{movimiento.aprobado_por ?? '—'}</dd>
            <dt className="text-muted-foreground">Formulario</dt>
            <dd>{movimiento.formulario_id ?? '—'}</dd>
            <dt className="text-muted-foreground">Motivo</dt>
            <dd className="col-span-2">{movimiento.motivo ?? '—'}</dd>
            <dt className="text-muted-foreground">Fecha</dt>
            <dd className="col-span-2">
              {new Date(movimiento.created_at).toLocaleString('es-CO')}
            </dd>
          </dl>
        )}
      </DialogContent>
    </Dialog>
  )
}
