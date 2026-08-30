import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatNumber } from '@/lib/format'
import type { MovimientoReciente } from '@/lib/types/dashboard'

const TIPO_LABELS: Record<MovimientoReciente['tipo_movimiento'], string> = {
  entrada: 'Entrada',
  salida_vin: 'Salida',
  ajuste: 'Ajuste',
  reverso: 'Reverso',
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
          <TableHead>VIN</TableHead>
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
              <TableCell>{new Date(mov.created_at).toLocaleString('es-CO')}</TableCell>
              <TableCell>{TIPO_LABELS[mov.tipo_movimiento]}</TableCell>
              <TableCell>{mov.vin}</TableCell>
              <TableCell className="text-right">{formatNumber(mov.cantidad)}</TableCell>
              <TableCell>{mov.actor_nombre ?? '—'}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
