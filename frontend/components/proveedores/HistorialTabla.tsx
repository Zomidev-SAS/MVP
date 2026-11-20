'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, Download, Upload } from 'lucide-react'
import { AvisoMigracion } from '@/components/proveedores/AvisoMigracion'
import { DesempenoDialog } from '@/components/proveedores/DesempenoDialog'
import { ImportarHistorialDialog } from '@/components/proveedores/ImportarHistorialDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  descargarCsvDesempeno,
  descargarPdfDesempeno,
  type ProveedorExportable,
} from '@/lib/export/proveedor-desempeno'
import { ETIQUETA_CALIDAD, type ConfigDesempeno } from '@/lib/proveedores/desempeno'
import { formatearFechaNumerica } from '@/lib/proveedores/fechas'
import {
  CLASE_PUNTO_NIVEL,
  formatearEntero,
  formatearPorcentaje,
  nivelCumplimiento,
} from '@/lib/proveedores/formato'
import { etiquetaOrden, type FilaHistorial } from '@/lib/proveedores/historial'
import { normalizarTexto } from '@/lib/proveedores/nit'
import { resumirDesempeno } from '@/lib/proveedores/resumen'
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

function Cumplimiento({ valor, umbral }: { valor: number | null; umbral: number }) {
  if (valor == null) return <Guion />
  return (
    <span className="inline-flex items-center justify-end gap-1.5 tabular-nums">
      <span
        aria-hidden="true"
        className={cn('h-1.5 w-1.5 rounded-full', CLASE_PUNTO_NIVEL[nivelCumplimiento(valor, umbral)])}
      />
      {formatearPorcentaje(valor)}
    </span>
  )
}

function Cifra({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <div className="text-xl font-semibold tabular-nums">{children}</div>
    </div>
  )
}

interface HistorialTablaProps {
  filas: FilaHistorial[]
  error?: string
  proveedorId: number
  proveedor: ProveedorExportable
  config: ConfigDesempeno
  /** Orden cuyo desempeño se abre al entrar (enlace desde Compras). */
  ordenInicial?: number | null
}

export function HistorialTabla({
  filas,
  error,
  proveedorId,
  proveedor,
  config,
  ordenInicial,
}: HistorialTablaProps) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<FiltroEstado>('todos')
  const [anio, setAnio] = useState('todos')
  const [seleccionada, setSeleccionada] = useState<FilaHistorial | null>(
    () => filas.find((f) => ordenInicial != null && f.orden_id === ordenInicial) ?? null
  )
  const [dialogoAbierto, setDialogoAbierto] = useState(seleccionada != null)
  const [importarAbierto, setImportarAbierto] = useState(false)

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

  const resumen = useMemo(() => resumirDesempeno(filas), [filas])

  function abrir(fila: FilaHistorial) {
    setSeleccionada(fila)
    setDialogoAbierto(true)
  }

  if (error === MIGRACION_PENDIENTE) {
    return <AvisoMigracion migracion="080_proveedores.sql" />
  }

  const dialogoImportar = (
    <ImportarHistorialDialog
      abierto={importarAbierto}
      onOpenChange={setImportarAbierto}
      proveedorId={proveedorId}
      proveedorNombre={proveedor.nombre}
      onImportado={() => router.refresh()}
    />
  )

  if (filas.length === 0) {
    return (
      <div className="rounded-md border">
        <EmptyState
          icon={ClipboardList}
          title="Este proveedor todavía no tiene órdenes de compra"
          description={
            error ?? 'Aparecen aquí cuando se crean en Compras, o puedes traer su historial desde el Excel de control.'
          }
        />
        <div className="flex justify-center pb-8">
          <Button variant="outline" onClick={() => setImportarAbierto(true)}>
            <Upload aria-hidden="true" />
            Importar historial
          </Button>
        </div>
        {dialogoImportar}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 divide-border rounded-md border sm:grid-cols-4 sm:divide-x">
        <div className="col-span-2 min-w-0 border-b px-4 py-3 sm:col-span-1 sm:border-b-0">
          <p className="text-xs text-muted-foreground">Cumplimiento promedio</p>
          <p className="flex items-center gap-2 text-3xl font-semibold tabular-nums">
            {resumen.porcentaje != null && (
              <span
                aria-hidden="true"
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  CLASE_PUNTO_NIVEL[nivelCumplimiento(resumen.porcentaje, config.umbral)]
                )}
              />
            )}
            {resumen.porcentaje == null ? '—' : formatearPorcentaje(resumen.porcentaje)}
          </p>
          <p className="text-xs text-muted-foreground">
            {resumen.porcentaje == null
              ? 'Sin órdenes finalizadas para calificar'
              : resumen.porcentaje >= config.umbral
                ? `Aprueba (mínimo ${formatearPorcentaje(config.umbral)})`
                : `No alcanza el ${formatearPorcentaje(config.umbral)}`}
          </p>
        </div>
        <Cifra etiqueta="Órdenes calificadas">
          {formatearEntero(resumen.calificadas)}
          <span className="text-sm font-normal text-muted-foreground"> de {formatearEntero(resumen.total)}</span>
        </Cifra>
        <Cifra etiqueta="Entregas con retraso">
          <span className={cn(resumen.conRetraso > 0 && 'text-[var(--warning)]')}>
            {formatearEntero(resumen.conRetraso)}
          </span>
        </Cifra>
        <Cifra etiqueta="Devoluciones">{formatearEntero(resumen.devoluciones)}</Cifra>
      </div>

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

        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" onClick={() => setImportarAbierto(true)}>
            <Upload aria-hidden="true" />
            Importar historial
          </Button>
          <Button variant="outline" size="sm" onClick={() => descargarCsvDesempeno(proveedor, visibles)}>
            <Download aria-hidden="true" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => descargarPdfDesempeno(proveedor, visibles, config)}
          >
            <Download aria-hidden="true" />
            PDF
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-[940px]">
          <TableHeader>
            <TableRow>
              <TableHead>Orden de compra</TableHead>
              <TableHead>Fecha de OC</TableHead>
              <TableHead title="Fecha de entrega prometida">Prometida</TableHead>
              <TableHead title="Fecha real de entrega">Real</TableHead>
              <TableHead className="text-right">Diferencia</TableHead>
              <TableHead className="text-right">Recibido</TableHead>
              <TableHead className="text-right">Devoluciones</TableHead>
              <TableHead>Calidad</TableHead>
              <TableHead className="text-right">Cumplimiento</TableHead>
              <TableHead>Factura o remisión</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                  Ninguna orden coincide con los filtros.
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((fila) => (
                <TableRow key={fila.clave} onClick={() => abrir(fila)} className="cursor-pointer">
                  <TableCell className="whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        abrir(fila)
                      }}
                      className="rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {etiquetaOrden(fila)}
                    </button>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatearFechaNumerica(fila.fecha_oc) ?? <Guion />}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatearFechaNumerica(fila.fecha_entrega_prometida) ?? <Guion />}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatearFechaNumerica(fila.fecha_entrega_real) ?? <Guion />}
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
                  <TableCell className="text-right tabular-nums">{formatearEntero(fila.devoluciones)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {fila.calidad ? (
                      <span className={cn(fila.calidad === 'mal' && 'text-destructive')}>
                        {ETIQUETA_CALIDAD[fila.calidad]}
                      </span>
                    ) : (
                      <Guion />
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Cumplimiento valor={fila.puntajes?.global ?? null} umbral={config.umbral} />
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

      <DesempenoDialog
        abierto={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        fila={seleccionada}
        proveedorId={proveedorId}
        proveedor={proveedor}
        config={config}
        onGuardado={() => router.refresh()}
      />
      {dialogoImportar}
    </div>
  )
}
