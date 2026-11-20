'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Search, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AvisoMigracion } from '@/components/proveedores/AvisoMigracion'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  CLASE_PUNTO_NIVEL,
  formatearEntero,
  formatearPorcentaje,
  nivelCumplimiento,
} from '@/lib/proveedores/formato'
import { normalizarNit, normalizarTexto } from '@/lib/proveedores/nit'
import { eliminarProveedor } from '@/lib/supabase/proveedores-actions'
import { MIGRACION_PENDIENTE, type OrigenProveedor, type ProveedorFila } from '@/lib/types/proveedor'
import { cn } from '@/lib/utils'

const PAGINA = 50

const ETIQUETA_ORIGEN: Record<OrigenProveedor, string> = {
  manual: 'Creado a mano',
  oc: 'Orden de compra',
  importado: 'Importado',
  siigo: 'Siigo',
}

interface ProveedoresListaProps {
  filas: ProveedorFila[]
  cargando: boolean
  error: string | null
  puedeEliminar: boolean
  onNuevo: () => void
  onImportar: () => void
  onEditar: (proveedor: ProveedorFila) => void
  onEliminado: () => void
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="truncate text-sm">{valor || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  )
}

export function ProveedoresLista({
  filas,
  cargando,
  error,
  puedeEliminar,
  onNuevo,
  onImportar,
  onEditar,
  onEliminado,
}: ProveedoresListaProps) {
  const [busqueda, setBusqueda] = useState('')
  const [incluirInactivos, setIncluirInactivos] = useState(false)
  const [limite, setLimite] = useState(PAGINA)
  const [expandidoId, setExpandidoId] = useState<number | null>(null)
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const hayInactivos = filas.some((p) => !p.activo)
  const hayCumplimiento = filas.some((p) => p.porcentaje_promedio != null)
  const hayReevaluacion = filas.some((p) => p.ultima_reevaluacion != null)
  const columnas = 2 + (hayCumplimiento ? 1 : 0) + (hayReevaluacion ? 1 : 0)

  const coincidencias = useMemo(() => {
    const texto = normalizarTexto(busqueda)
    const nit = normalizarNit(busqueda)
    return filas.filter((p) => {
      if (!p.activo && !incluirInactivos) return false
      if (!texto) return true
      return (
        normalizarTexto(p.nombre).includes(texto) ||
        (nit !== '' && p.nit_normalizado.includes(nit))
      )
    })
  }, [filas, busqueda, incluirInactivos])

  const visibles = coincidencias.slice(0, limite)

  function alternar(id: number) {
    setExpandidoId((actual) => (actual === id ? null : id))
    setConfirmandoId(null)
  }

  async function confirmarEliminacion(proveedor: ProveedorFila) {
    setEliminando(true)
    const resultado = await eliminarProveedor(proveedor.id)
    setEliminando(false)

    if (!resultado.ok) {
      toast.error(resultado.error)
      return
    }
    toast.success('Proveedor eliminado.')
    setConfirmandoId(null)
    setExpandidoId(null)
    onEliminado()
  }

  if (error === MIGRACION_PENDIENTE) {
    return <AvisoMigracion migracion="080_proveedores.sql" />
  }

  return (
    <div className="space-y-3">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
        >
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="relative w-full sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setLimite(PAGINA)
            }}
            placeholder="Buscar por nombre o NIT"
            aria-label="Buscar proveedor por nombre o NIT"
            className="pl-9"
          />
        </div>

        {hayInactivos && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={incluirInactivos}
              onChange={(e) => setIncluirInactivos(e.target.checked)}
              className="h-4 w-4 rounded border"
            />
            Mostrar inactivos
          </label>
        )}

        <p className="text-sm tabular-nums text-muted-foreground sm:ml-auto" aria-live="polite">
          {cargando
            ? 'Cargando...'
            : `${formatearEntero(coincidencias.length)} proveedor${coincidencias.length === 1 ? '' : 'es'}`}
        </p>
      </div>

      {cargando ? (
        <div className="space-y-px overflow-hidden rounded-md border" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse bg-muted/60" />
          ))}
        </div>
      ) : filas.length === 0 && !error ? (
        <div className="rounded-md border">
          <EmptyState
            icon={Truck}
            title="Todavía no hay proveedores"
            description="Crea uno o importa tu listado desde un archivo CSV."
          />
          <div className="flex justify-center gap-2 pb-8">
            <Button onClick={onNuevo}>Nuevo proveedor</Button>
            <Button variant="outline" onClick={onImportar}>
              Importar CSV
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead className="w-24 text-right">Órdenes</TableHead>
                {hayCumplimiento && <TableHead className="w-36 text-right">Cumplimiento</TableHead>}
                {hayReevaluacion && <TableHead className="w-44">Última reevaluación</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columnas} className="py-8 text-center text-muted-foreground">
                    Ningún proveedor coincide con &ldquo;{busqueda}&rdquo;.
                  </TableCell>
                </TableRow>
              ) : (
                visibles.map((proveedor) => {
                  const abierto = expandidoId === proveedor.id
                  const reevaluacion = proveedor.ultima_reevaluacion
                  return (
                    <ProveedorFilaTabla
                      key={proveedor.id}
                      proveedor={proveedor}
                      abierto={abierto}
                      columnas={columnas}
                      hayCumplimiento={hayCumplimiento}
                      hayReevaluacion={hayReevaluacion}
                      reevaluacion={reevaluacion}
                      puedeEliminar={puedeEliminar}
                      confirmando={confirmandoId === proveedor.id}
                      eliminando={eliminando}
                      onAlternar={() => alternar(proveedor.id)}
                      onEditar={() => onEditar(proveedor)}
                      onPedirConfirmacion={() => setConfirmandoId(proveedor.id)}
                      onCancelarConfirmacion={() => setConfirmandoId(null)}
                      onConfirmar={() => confirmarEliminacion(proveedor)}
                    />
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!cargando && coincidencias.length > visibles.length && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm tabular-nums text-muted-foreground">
            Mostrando {formatearEntero(visibles.length)} de {formatearEntero(coincidencias.length)}
          </p>
          <Button variant="outline" onClick={() => setLimite((actual) => actual + PAGINA)}>
            Mostrar más
          </Button>
        </div>
      )}
    </div>
  )
}

interface ProveedorFilaTablaProps {
  proveedor: ProveedorFila
  abierto: boolean
  columnas: number
  hayCumplimiento: boolean
  hayReevaluacion: boolean
  reevaluacion: ProveedorFila['ultima_reevaluacion']
  puedeEliminar: boolean
  confirmando: boolean
  eliminando: boolean
  onAlternar: () => void
  onEditar: () => void
  onPedirConfirmacion: () => void
  onCancelarConfirmacion: () => void
  onConfirmar: () => void
}

function ProveedorFilaTabla({
  proveedor,
  abierto,
  columnas,
  hayCumplimiento,
  hayReevaluacion,
  reevaluacion,
  puedeEliminar,
  confirmando,
  eliminando,
  onAlternar,
  onEditar,
  onPedirConfirmacion,
  onCancelarConfirmacion,
  onConfirmar,
}: ProveedorFilaTablaProps) {
  const detalleId = `proveedor-detalle-${proveedor.id}`

  return (
    <>
      <TableRow onClick={onAlternar} className="cursor-pointer">
        <TableCell>
          <button
            type="button"
            aria-expanded={abierto}
            aria-controls={detalleId}
            onClick={(e) => {
              e.stopPropagation()
              onAlternar()
            }}
            className="flex w-full items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChevronRight
              aria-hidden="true"
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                abierto && 'rotate-90'
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{proveedor.nombre}</span>
              <span className="block text-xs tabular-nums text-muted-foreground">{proveedor.nit}</span>
            </span>
            {!proveedor.activo && <Badge variant="outline">Inactivo</Badge>}
          </button>
        </TableCell>

        <TableCell className="text-right tabular-nums">
          {formatearEntero(proveedor.total_ordenes)}
        </TableCell>

        {hayCumplimiento && (
          <TableCell className="text-right">
            {proveedor.porcentaje_promedio == null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span className="inline-flex items-center justify-end gap-1.5 tabular-nums">
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    CLASE_PUNTO_NIVEL[nivelCumplimiento(proveedor.porcentaje_promedio)]
                  )}
                />
                {formatearPorcentaje(proveedor.porcentaje_promedio)}
              </span>
            )}
          </TableCell>
        )}

        {hayReevaluacion && (
          <TableCell>
            {reevaluacion ? (
              <span className="text-sm tabular-nums">
                {reevaluacion.anio} ·{' '}
                <span className={cn(reevaluacion.resultado === 'no_continuar' && 'text-destructive')}>
                  {reevaluacion.resultado === 'continuar' ? 'Continuar' : 'No continuar'}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </TableCell>
        )}
      </TableRow>

      {abierto && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={columnas} id={detalleId} className="bg-muted/30 whitespace-normal">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <Dato etiqueta="Correo" valor={proveedor.email} />
              <Dato etiqueta="Teléfono" valor={proveedor.telefono} />
              <Dato etiqueta="Contacto" valor={proveedor.contacto} />
              <Dato etiqueta="Origen" valor={ETIQUETA_ORIGEN[proveedor.origen]} />
              {proveedor.notas && (
                <div className="sm:col-span-2 lg:col-span-4">
                  <dt className="text-xs text-muted-foreground">Notas</dt>
                  <dd className="text-sm">{proveedor.notas}</dd>
                </div>
              )}
            </dl>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href={`/proveedores/${proveedor.id}`}
                className={buttonVariants({ variant: 'default', size: 'sm' })}
              >
                Abrir historial
              </Link>
              <Button variant="outline" size="sm" onClick={onEditar}>
                Editar
              </Button>
              {puedeEliminar &&
                (confirmando ? (
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <span>¿Eliminar este proveedor?</span>
                    <Button variant="destructive" size="sm" disabled={eliminando} onClick={onConfirmar}>
                      {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onCancelarConfirmacion}>
                      Cancelar
                    </Button>
                  </span>
                ) : (
                  <Button variant="ghost" size="sm" onClick={onPedirConfirmacion}>
                    Eliminar
                  </Button>
                ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
