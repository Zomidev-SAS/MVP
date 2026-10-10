import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber } from '@/lib/format'

export interface ProductoBajoStock {
  codigo_producto: string
  nombre_producto: string | null
  saldo: number
}

export function LowStockList({ productos }: { productos: ProductoBajoStock[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos con stock bajo</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Sin productos en stock bajo.
                </TableCell>
              </TableRow>
            ) : (
              productos.map((p) => (
                <TableRow key={p.codigo_producto}>
                  <TableCell className="font-mono text-sm">{p.codigo_producto}</TableCell>
                  <TableCell>{p.nombre_producto ?? '—'}</TableCell>
                  <TableCell className="text-right">{formatNumber(p.saldo)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
