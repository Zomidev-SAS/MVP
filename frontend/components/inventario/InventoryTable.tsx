'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
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
import { fetchInventario, INVENTARIO_PAGE_SIZE } from '@/lib/supabase/get-inventario'
import { formatCOP, formatNumber } from '@/lib/format'
import type { InventarioFiltros, InventarioItem } from '@/lib/types/inventario'

const STOCK_BAJO_THRESHOLD = 2

const FILTROS_INICIALES: InventarioFiltros = {
  vin: '',
  marca: '',
  categoria: '',
  estado: 'todos',
  desde: '',
  hasta: '',
}

export function InventoryTable() {
  const [filtros, setFiltros] = useState<InventarioFiltros>(FILTROS_INICIALES)
  const [pagina, setPagina] = useState(1)
  const [filas, setFilas] = useState<InventarioItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

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
    }, 500)

    return () => clearTimeout(timeout)
  }, [filtros, pagina])

  function handleFiltrosChange(nuevosFiltros: InventarioFiltros) {
    setFiltros(nuevosFiltros)
    setPagina(1)
  }

  function handleExportarCsv() {
    const encabezados = [
      'VIN',
      'Marca',
      'Categoría',
      'Ubicación',
      'Saldo',
      'Valor Unitario',
      'Valor Total',
      'Último Movimiento',
    ]
    const filasCsv = filas.map((item) =>
      [
        item.vin,
        item.marca ?? '',
        item.categoria ?? '',
        item.ubicacion ?? '',
        item.saldo,
        item.valor_unitario ?? '',
        item.valor_total,
        item.ultimo_movimiento,
      ]
        .map((valor) => `"${String(valor).replace(/"/g, '""')}"`)
        .join(',')
    )
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

  return (
    <div className="space-y-4">
      <InventoryFilters filtros={filtros} onChange={handleFiltrosChange} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Cargando...' : `Mostrando ${filas.length} de ${total} resultados`}
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>VIN</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Ubicación</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead className="text-right">Valor Total</TableHead>
            <TableHead>Último Movimiento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {loading ? 'Cargando...' : 'Sin resultados.'}
              </TableCell>
            </TableRow>
          ) : (
            filas.map((item) => (
              <TableRow key={item.vin}>
                <TableCell className="font-medium">{item.vin}</TableCell>
                <TableCell>{item.marca ?? '—'}</TableCell>
                <TableCell>{item.categoria ?? '—'}</TableCell>
                <TableCell>{item.ubicacion ?? '—'}</TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center gap-1">
                    {item.saldo <= STOCK_BAJO_THRESHOLD && (
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    {formatNumber(item.saldo)}
                  </span>
                </TableCell>
                <TableCell className="text-right">{formatCOP(item.valor_total)}</TableCell>
                <TableCell>
                  {new Date(item.ultimo_movimiento).toLocaleDateString('es-CO')}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

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
    </div>
  )
}
