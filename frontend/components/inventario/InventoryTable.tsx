'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ShoppingCart } from 'lucide-react'
import { OrdenCompraDialog } from '@/components/inventario/OrdenCompraDialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { InventoryFilters } from '@/components/inventario/InventoryFilters'
import { fetchInventario } from '@/lib/supabase/inventario-actions'
import { INVENTARIO_PAGE_SIZE } from '@/lib/supabase/inventario-page-size'
import { formatCOP, formatNumber } from '@/lib/format'
import type { InventarioFiltros, InventarioItem } from '@/lib/types/inventario'

const STOCK_BAJO_THRESHOLD = 2

const FILTROS_INICIALES: InventarioFiltros = {
  busqueda: '',
  categoria: '',
  bodega: '',
  estado: 'todos',
  desde: '',
  hasta: '',
}

export function InventoryTable({ puedeVerCostos }: { puedeVerCostos: boolean }) {
  const [filtros, setFiltros] = useState<InventarioFiltros>(FILTROS_INICIALES)
  const [pagina, setPagina] = useState(1)
  const [filas, setFilas] = useState<InventarioItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [productoOc, setProductoOc] = useState<InventarioItem | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true)
      fetchInventario(filtros, pagina)
        .then((resultado) => {
          setFilas(resultado.filas)
          setTotal(resultado.total)
        })
        .catch((error) => {
          console.error('Failed to fetch inventario:', error)
          setFilas([])
          setTotal(0)
        })
        .finally(() => setLoading(false))
    }, 300)

    return () => clearTimeout(timeout)
  }, [filtros, pagina])

  function handleFiltrosChange(nuevosFiltros: InventarioFiltros) {
    setFiltros(nuevosFiltros)
    setPagina(1)
  }

  function handleExportarCsv() {
    const encabezadosCosto = puedeVerCostos ? ['Valor Unitario', 'Valor Total'] : []
    const encabezados = ['Código', 'Nombre', 'Categoría', 'Saldo', ...encabezadosCosto, 'Último Movimiento']

    const filasCsv = filas.map((item) => {
      const valoresCosto = puedeVerCostos
        ? [item.valor_unitario ?? '', item.valor_total ?? '']
        : []
      const base = [
        item.codigo_producto,
        item.nombre_producto ?? '',
        item.categoria ?? '',
        item.saldo,
        ...valoresCosto,
        item.ultimo_movimiento ?? '',
      ]
      return base.map((valor) => `"${String(valor).replace(/"/g, '""')}"`).join(',')
    })

    const csv = [encabezados.join(','), ...filasCsv].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = 'inventario.csv'
    enlace.click()
    URL.revokeObjectURL(url)
  }

  const totalPaginas = Math.max(1, Math.ceil(total / INVENTARIO_PAGE_SIZE))
  const totalColumnas = (puedeVerCostos ? 6 : 4) + 1

  return (
    <div className="space-y-4">
      <InventoryFilters filtros={filtros} onChange={handleFiltrosChange} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Cargando...' : `Mostrando ${filas.length} de ${total} productos`}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={handleExportarCsv}
          disabled={filas.length === 0}
        >
          Exportar CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-[880px]">
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Código</TableHead>
              <TableHead className="whitespace-nowrap">Nombre</TableHead>
              <TableHead className="whitespace-nowrap">Categoría</TableHead>
              <TableHead className="whitespace-nowrap text-right">Saldo</TableHead>
              {puedeVerCostos && (
                <>
                  <TableHead className="whitespace-nowrap text-right">Valor unit.</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Valor total</TableHead>
                </>
              )}
              <TableHead className="whitespace-nowrap">Último mov.</TableHead>
              <TableHead className="whitespace-nowrap w-[52px]">OC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalColumnas} className="text-center text-muted-foreground">
                  {loading ? 'Cargando...' : 'Sin resultados.'}
                </TableCell>
              </TableRow>
            ) : (
              filas.map((item) => (
                <TableRow key={item.codigo_producto}>
                  <TableCell className="font-mono text-sm">{item.codigo_producto}</TableCell>
                  <TableCell
                    className="max-w-[240px] truncate"
                    title={item.nombre_producto ?? undefined}
                  >
                    {item.nombre_producto ?? '—'}
                  </TableCell>
                  <TableCell>{item.categoria ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1">
                      {item.saldo <= STOCK_BAJO_THRESHOLD && item.saldo > 0 && (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      {formatNumber(item.saldo)}
                    </span>
                  </TableCell>
                  {puedeVerCostos && (
                    <>
                      <TableCell className="text-right">
                        {item.valor_unitario != null ? formatCOP(item.valor_unitario) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.valor_total != null ? formatCOP(item.valor_total) : '—'}
                      </TableCell>
                    </>
                  )}
                  <TableCell>
                    {item.ultimo_movimiento
                      ? new Date(item.ultimo_movimiento).toLocaleDateString('es-CO')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label="Orden de compra"
                      onClick={() => setProductoOc(item)}
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPagina((p) => Math.max(1, p - 1))}
          disabled={pagina <= 1}
        >
          Anterior
        </Button>
        <p className="text-sm text-muted-foreground">
          Página {pagina} de {totalPaginas}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
          disabled={pagina >= totalPaginas}
        >
          Siguiente
        </Button>
      </div>

      <OrdenCompraDialog
        producto={productoOc}
        abierto={productoOc !== null}
        onOpenChange={(open) => { if (!open) setProductoOc(null) }}
      />
    </div>
  )
}
