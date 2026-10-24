import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatFechaHora, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MovimientoReciente } from '@/lib/types/dashboard'

const TIPO_LABELS: Record<MovimientoReciente['tipo_movimiento'], string> = {
  entrada: 'Entrada',
  salida_vin: 'Salida (app)',
  ajuste: 'Ajuste',
  reverso: 'Reverso',
}

const TIPO_COLORES: Record<MovimientoReciente['tipo_movimiento'], string> = {
  entrada: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  salida_vin: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  ajuste: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  reverso: 'bg-destructive/15 text-destructive',
}

export function UltimosMovimientosTable({
  movimientos,
}: {
  movimientos: MovimientoReciente[]
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Producto</TableHead>
          <TableHead className="text-right">Cantidad</TableHead>
          <TableHead>Usuario</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movimientos.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground">
              Sin movimientos registrados.
            </TableCell>
          </TableRow>
        ) : (
          movimientos.map((mov) => (
            <TableRow key={mov.id}>
              <TableCell>{formatFechaHora(mov.created_at)}</TableCell>
              <TableCell>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    TIPO_COLORES[mov.tipo_movimiento]
                  )}
                >
                  {TIPO_LABELS[mov.tipo_movimiento]}
                </span>
              </TableCell>
              <TableCell>{mov.codigo_producto}</TableCell>
              <TableCell className="text-right">{formatNumber(mov.cantidad)}</TableCell>
              <TableCell>{mov.actor_nombre ?? '—'}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
