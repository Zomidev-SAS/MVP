'use client'

import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { MovementsFilters } from '@/components/movimientos/MovementsFilters'
import { MovementDetailDialog } from '@/components/movimientos/MovementDetailDialog'
import { fetchMovimientos } from '@/lib/supabase/movimientos-actions'
import { MOVIMIENTOS_PAGE_SIZE } from '@/lib/supabase/movimientos-page-size'
import { formatNumber } from '@/lib/format'
import type { MovimientoDetalle, MovimientosFiltros } from '@/lib/types/movimientos'

const TIPO_LABELS: Record<MovimientoDetalle['tipo_movimiento'], string> = {
  entrada: 'Entrada',
  salida_vin: 'Salida',
  ajuste: 'Ajuste',
  reverso: 'Reverso',
}

const FILTROS_INICIALES: MovimientosFiltros = {
  vin: '',
  tipo: 'todos',
  desde: '',
  hasta: '',
}

export function MovementsTable() {
  const [filtros, setFiltros] = useState<MovimientosFiltros>(FILTROS_INICIALES)
  const [pagina, setPagina] = useState(1)
  const [filas, setFilas] = useState<MovimientoDetalle[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [seleccionado, setSeleccionado] = useState<MovimientoDetalle | null>(null)
  const [dialogAbierto, setDialogAbierto] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true)
      fetchMovimientos(filtros, pagina)
        .then((resultado) => {
          setFilas(resultado.filas)
          setTotal(resultado.total)
        })
        .catch((error) => {
          console.error('Failed to fetch movimientos:', error)
          setFilas([])
          setTotal(0)
        })
        .finally(() => setLoading(false))
    }, 500)

    return () => clearTimeout(timeout)
  }, [filtros, pagina])

  function handleFiltrosChange(nuevosFiltros: MovimientosFiltros) {
    setFiltros(nuevosFiltros)
    setPagina(1)
  }

  function handleRowClick(movimiento: MovimientoDetalle) {
    setSeleccionado(movimiento)
    setDialogAbierto(true)
  }

  const totalPaginas = Math.max(1, Math.ceil(total / MOVIMIENTOS_PAGE_SIZE))

  return (
    <div className="space-y-4">
      <MovementsFilters filtros={filtros} onChange={handleFiltrosChange} />

      <p className="text-sm text-muted-foreground">
        {loading ? 'Cargando...' : `Mostrando ${filas.length} de ${total} resultados`}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>VIN</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead>Ubicación</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Estado</TableHead>
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
              <TableRow
                key={item.id}
                onClick={() => handleRowClick(item)}
                className="cursor-pointer hover:bg-accent"
              >
                <TableCell>{new Date(item.created_at).toLocaleDateString('es-CO')}</TableCell>
                <TableCell>{TIPO_LABELS[item.tipo_movimiento]}</TableCell>
                <TableCell className="font-medium">{item.vin}</TableCell>
                <TableCell className="text-right">{formatNumber(item.cantidad)}</TableCell>
                <TableCell>{item.ubicacion ?? '—'}</TableCell>
                <TableCell>{item.actor_nombre ?? '—'}</TableCell>
                <TableCell>{item.estado}</TableCell>
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

      <MovementDetailDialog
        movimiento={seleccionado}
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
      />
    </div>
  )
}
