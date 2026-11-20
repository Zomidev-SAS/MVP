'use client'

import { useMemo, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { AvisoMigracion } from '@/components/proveedores/AvisoMigracion'
import { EmptyState } from '@/components/shared/EmptyState'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatearFechaCorta } from '@/lib/proveedores/fechas'
import { formatearEntero } from '@/lib/proveedores/formato'
import { etiquetaOrden, type FilaHistorial } from '@/lib/proveedores/historial'
import { normalizarTexto } from '@/lib/proveedores/nit'
import { MIGRACION_PENDIENTE } from '@/lib/types/proveedor'
import { CLASE_ESTADO_OC, ETIQUETA_ESTADO_OC } from '@/lib/types/orden-compra'
import { cn } from '@/lib/utils'

const SELECT_CLASS =
  'flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

type FiltroEstado = 'todos' | FilaHistorial['estado']

const ESTADOS_FILTRO: Array<{ valor: FiltroEstado; etiqueta: string }> = [
  { valor: 'todos', etiqueta: 'Todos los estados' },
  { valor: 'en_curso', etiqueta: ETIQUETA_ESTADO_OC.en_curso },
  { valor: 'listo', etiqueta: ETIQUETA_ESTADO_OC.listo },
  { valor: 'cancelada', etiqueta: ETIQUETA_ESTADO_OC.cancelada },
  { valor: 'historico', etiqueta: 'Histórico' },
]

function etiquetaEstado(estado: FilaHistorial['estado']): string {
  return estado === 'historico' ? 'Histórico' : ETIQUETA_ESTADO_OC[estado]
}

function claseEstado(estado: FilaHistorial['estado']): string {
  return estado === 'historico' ? 'chip-neutral' : CLASE_ESTADO_OC[estado]
}

function Guion() {
  return <span className="text-muted-foreground">—</span>
}

function Diferencia({ dias }: { dias: number | null }) {
  if (dias == null) return <Guion />
  const texto = dias > 0 ? `+${dias}` : dias < 0 ? `−${Math.abs(dias)}` : '0'
  return (
    <span className={cn('tabular-nums', dias > 0 && 'font-medium text-[var(--warning)]')}>
      {texto} <span className="text-xs font-normal text-muted-foreground">d</span>
    </span>
  )
}

interface HistorialTablaProps {
  filas: FilaHistorial[]
  error?: string
}

export function HistorialTabla({ filas, error }: HistorialTablaProps) {
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<FiltroEstado>('todos')
  const [anio, setAnio] = useState('todos')

  const anios = useMemo(
    () =>
      [...new Set(filas.map((f) => f.fecha_oc?.slice(0, 4)).filter((a): a is string => !!a))].sort(
        (a, b) => b.localeCompare(a)
      ),
    [filas]
  )

  const visibles = useMemo(() => {
    const texto = normalizarTexto(busqueda)
    return filas.filter((fila) => {
      if (estado !== 'todos' && fila.estado !== estado) return false
      if (anio !== 'todos' && fila.fecha_oc?.slice(0, 4) !== anio) return false
      if (!texto) return true
      return (
        normalizarTexto(etiquetaOrden(fila)).includes(texto) ||
        normalizarTexto(fila.factura_remision).includes(texto)
      )
    })
  }, [filas, busqueda, estado, anio])

  const finalizadas = filas.filter((f) => f.estado === 'listo' || f.estado === 'historico').length
  const conRetraso = filas.filter((f) => (f.diferencia_dias ?? 0) > 0).length

  if (error === MIGRACION_PENDIENTE) {
    return <AvisoMigracion migracion="080_proveedores.sql" />
  }

  if (filas.length === 0) {
    return (
      <div className="rounded-md border">
        <EmptyState
          icon={ClipboardList}
          title="Este proveedor todavía no tiene órdenes de compra"
          description={error ?? 'Aparecen aquí cuando se crean en Compras.'}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar orden o factura"
          aria-label="Buscar por número de orden o factura"
          className="w-full sm:w-56"
        />
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as FiltroEstado)}
          aria-label="Filtrar por estado"
          className={SELECT_CLASS}
        >
          {ESTADOS_FILTRO.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
        {anios.length > 1 && (
          <select
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            aria-label="Filtrar por año"
            className={SELECT_CLASS}
          >
            <option value="todos">Todos los años</option>
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}

        <p className="text-sm tabular-nums text-muted-foreground sm:ml-auto" aria-live="polite">
          {formatearEntero(filas.length)} órdenes · {formatearEntero(finalizadas)} finalizadas ·{' '}
          {formatearEntero(conRetraso)} con retraso
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>Orden de compra</TableHead>
              <TableHead>Fecha de OC</TableHead>
              <TableHead>Entrega prometida</TableHead>
              <TableHead>Entrega real</TableHead>
              <TableHead className="text-right">Diferencia</TableHead>
              <TableHead className="text-right">Recibido / pedido</TableHead>
              <TableHead className="text-right">Devoluciones</TableHead>
              <TableHead>Factura o remisión</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Ninguna orden coincide con los filtros.
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((fila) => (
                <TableRow key={fila.clave}>
                  <TableCell className="whitespace-nowrap font-medium">{etiquetaOrden(fila)}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatearFechaCorta(fila.fecha_oc) ?? <Guion />}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatearFechaCorta(fila.fecha_entrega_prometida) ?? <Guion />}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatearFechaCorta(fila.fecha_entrega_real) ?? <Guion />}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Diferencia dias={fila.diferencia_dias} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {fila.cantidad_pedida == null ? (
                      <Guion />
                    ) : (
                      <>
                        {formatearEntero(fila.cantidad_recibida ?? 0)}
                        <span className="text-muted-foreground"> / {formatearEntero(fila.cantidad_pedida)}</span>
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearEntero(fila.devoluciones)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {fila.factura_remision ?? <Guion />}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-block whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold',
                        claseEstado(fila.estado)
                      )}
                    >
                      {etiquetaEstado(fila.estado)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground md:hidden">
        Desliza horizontalmente para ver todas las columnas.
      </p>
    </div>
  )
}
