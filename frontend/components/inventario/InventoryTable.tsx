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
  busqueda: '',
  vin: '',
  marca: '',
  categoria: '',
  ubicacion: '',
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
  const [fuente, setFuente] = useState<'excel' | 'supabase'>('excel')
  const [origen, setOrigen] = useState<'nube' | 'local' | undefined>('nube')
  const [fechaCorte, setFechaCorte] = useState<string | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true)
      fetchInventario(filtros, pagina)
        .then((resultado) => {
          setFilas(resultado.filas)
          setTotal(resultado.total)
          setFuente(resultado.fuente)
          setOrigen(resultado.origen)
          setFechaCorte(resultado.fechaCorte ?? null)
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
    const esExcel = fuente === 'excel'
    const encabezadosCosto = puedeVerCostos ? ['Valor Unitario', 'Valor Total'] : []
    const encabezados = esExcel
      ? ['Código', 'Nombre', 'Categoría', 'Ubicación', 'Unidad', 'Saldo', ...encabezadosCosto]
      : ['VIN', 'Marca', 'Categoría', 'Ubicación', 'Saldo', ...encabezadosCosto, 'Último Movimiento']

    const filasCsv = filas.map((item) => {
      const valoresCosto = puedeVerCostos ? [item.valor_unitario ?? '', item.valor_total] : []
      const base = esExcel
        ? [
            item.codigo,
            item.nombre ?? '',
            item.categoria ?? '',
            item.ubicacion ?? '',
            item.unidad ?? '',
            item.saldo,
            ...valoresCosto,
          ]
        : [
            item.vin ?? item.codigo,
            item.marca ?? '',
            item.categoria ?? '',
            item.ubicacion ?? '',
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
  const esExcel = fuente === 'excel'
  const esNube = origen === 'nube'

  return (
    <div className="space-y-4">
      {esExcel && esNube && total === 0 && !loading && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Aún no hay inventario publicado. Un supervisor puede subir el Excel en{' '}
          <span className="font-medium">Importar</span>.
        </p>
      )}

      {esExcel && fechaCorte && total > 0 && (
        <p className="rounded-md border border-border/80 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {esNube ? 'Inventario del equipo' : 'Vista local (solo tu PC)'} · corte:{' '}
          <span className="font-medium text-foreground">{fechaCorte}</span>
        </p>
      )}

      <InventoryFilters filtros={filtros} fuente={fuente} onChange={handleFiltrosChange} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading
            ? 'Cargando...'
            : `Mostrando ${filas.length} de ${total} productos${esNube ? '' : esExcel ? ' (local)' : ''}`}
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
              <TableHead className="whitespace-nowrap">{esExcel ? 'Código' : 'VIN'}</TableHead>
              {esExcel && <TableHead className="whitespace-nowrap">Nombre</TableHead>}
              {!esExcel && <TableHead className="whitespace-nowrap">Marca</TableHead>}
              <TableHead className="whitespace-nowrap">Categoría</TableHead>
              <TableHead className="whitespace-nowrap">Ubicación</TableHead>
              {esExcel && <TableHead className="whitespace-nowrap">Unidad</TableHead>}
              <TableHead className="whitespace-nowrap text-right">Saldo</TableHead>
              {puedeVerCostos && (
                <>
                  <TableHead className="whitespace-nowrap text-right">Valor unit.</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Valor total</TableHead>
                </>
              )}
              {!esExcel && <TableHead className="whitespace-nowrap">Último mov.</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={puedeVerCostos ? 8 : 6}
                  className="text-center text-muted-foreground"
                >
                  {loading ? 'Cargando...' : 'Sin resultados.'}
                </TableCell>
              </TableRow>
            ) : (
              filas.map((item) => (
                <TableRow key={item.codigo}>
                  <TableCell className="font-mono text-sm">{item.codigo}</TableCell>
                  {esExcel && (
                    <TableCell className="max-w-[240px] truncate" title={item.nombre ?? undefined}>
                      {item.nombre ?? '—'}
                    </TableCell>
                  )}
                  {!esExcel && <TableCell>{item.marca ?? '—'}</TableCell>}
                  <TableCell>{item.categoria ?? '—'}</TableCell>
                  <TableCell>{item.ubicacion ?? '—'}</TableCell>
                  {esExcel && <TableCell>{item.unidad ?? '—'}</TableCell>}
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
                      <TableCell className="text-right">{formatCOP(item.valor_total)}</TableCell>
                    </>
                  )}
                  {!esExcel && (
                    <TableCell>
                      {item.ultimo_movimiento
                        ? new Date(item.ultimo_movimiento).toLocaleDateString('es-CO')
                        : '—'}
                    </TableCell>
                  )}
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
    </div>
  )
}
