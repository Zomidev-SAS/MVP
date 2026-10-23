'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, ChevronRight, Clock, Plus, Search, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  CLASE_ESTADO_OC,
  ETIQUETA_ESTADO_OC,
  resumenRecepcion,
  tituloOrdenDisplay,
  type EstadoOrdenCompra,
  type OrdenCompra,
} from '@/lib/types/orden-compra'
import {
  actualizarEstadoOrdenCompra,
  eliminarOrdenCompra,
  enviarOrdenASiigo,
  fetchOrdenesCompra,
  marcarOrdenDescargadaSiigo,
  reintentarEnvioSiigo,
} from '@/lib/supabase/ordenes-compra-actions'
import { derivarEstadoSiigo } from '@/lib/supabase/orden-compra-siigo-status'
import { descargarCsvSiigo } from '@/lib/export/orden-compra-siigo'
import { descargarPdfOrdenCompra } from '@/lib/export/orden-compra-pdf'
import { ComprasPedidoDialog } from '@/components/compras/ComprasPedidoDialog'
import { SiigoStatusBadge, ETIQUETA_SIIGO_SYNC } from '@/components/compras/SiigoStatusBadge'
import { OrdenDetalle } from '@/components/compras/OrdenDetalle'
import { ResumenCompras, coincideFiltro, estaVencida, type FiltroCompras } from '@/components/compras/ResumenCompras'
import { Skeleton } from '@/components/ui/skeleton'
import { FacturaProveedorDialog, type ModoFacturaProveedor } from '@/components/compras/FacturaProveedorDialog'
import { subirOrdenCompraDocumento } from '@/lib/supabase/ordenes-compra-documento-actions'
import type { EstadoSyncSiigo } from '@/lib/types/siigo'

function formatearVencimiento(fecha: string | null): string {
  if (!fecha) return '—'
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

function iconoVencimiento(orden: OrdenCompra) {
  if (orden.estado === 'listo') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
  }
  if (!orden.fecha_vencimiento) {
    return <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
  }
  if (estaVencida(orden)) {
    return <AlertCircle className="h-4 w-4 text-destructive" aria-hidden />
  }
  return <Clock className="h-4 w-4 text-amber-600" aria-hidden />
}

/** "Vencida hace 3 d", "Vence hoy", "En 2 d" o la fecha: lo urgente se nota de un vistazo. */
function textoEntrega(orden: OrdenCompra): { texto: string; clase: string } {
  if (orden.estado !== 'en_curso') {
    return { texto: formatearVencimiento(orden.fecha_vencimiento), clase: '' }
  }
  if (!orden.fecha_vencimiento) return { texto: 'Sin fecha', clase: 'text-muted-foreground' }
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vence = new Date(`${orden.fecha_vencimiento}T12:00:00`)
  const dias = Math.round((vence.getTime() - hoy.getTime()) / 86_400_000)
  if (dias < 0) return { texto: `Vencida hace ${-dias} d`, clase: 'font-semibold text-destructive' }
  if (dias === 0) return { texto: 'Vence hoy', clase: 'font-semibold text-amber-700' }
  if (dias <= 3) return { texto: `En ${dias} d`, clase: 'font-medium text-amber-700' }
  return { texto: formatearVencimiento(orden.fecha_vencimiento), clase: '' }
}

const COLUMNAS = 6

// Franja de color a la izquierda de cada orden: amarillo en proceso, rojo finalizado.
const BORDE_ESTADO: Record<EstadoOrdenCompra, string> = {
  en_curso: 'border-l-yellow-400',
  listo: 'border-l-primary',
  cancelada: 'border-l-muted-foreground/30',
}

const CHIPS: { id: FiltroCompras; etiqueta: string }[] = [
  { id: 'todas', etiqueta: 'Todas' },
  { id: 'proceso', etiqueta: 'En proceso' },
  { id: 'finalizadas', etiqueta: 'Finalizadas' },
  { id: 'canceladas', etiqueta: 'Canceladas' },
]

interface ComprasTableProps {
  productoInicial?: { codigo: string; nombre: string } | null
  puedeGestionarSiigo: boolean
  /** El administrador (supervisor) puede firmar las OC cargadas desde Siigo. */
  puedeFirmar: boolean
}

export function ComprasTable({ productoInicial, puedeGestionarSiigo, puedeFirmar }: ComprasTableProps) {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroCompras>('todas')
  const [filtroSiigo, setFiltroSiigo] = useState<'todos' | EstadoSyncSiigo>('todos')
  const [dialogAbierto, setDialogAbierto] = useState(Boolean(productoInicial))
  const [ordenEditar, setOrdenEditar] = useState<OrdenCompra | null>(null)
  // Órdenes desplegadas: la fila compacta se abre al seleccionarla.
  const [abiertas, setAbiertas] = useState<Set<number>>(new Set())
  const [enviandoSiigoId, setEnviandoSiigoId] = useState<number | null>(null)
  const [subiendoDocumento, setSubiendoDocumento] = useState(false)
  const [dialogoFactura, setDialogoFactura] = useState<{ orden: OrdenCompra; modo: ModoFacturaProveedor } | null>(null)
  const inputDocumentoRef = useRef<HTMLInputElement>(null)

  const recargar = useCallback(async () => {
    setLoading(true)
    try {
      setOrdenes(await fetchOrdenesCompra())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return ordenes.filter((o) => {
      if (!coincideFiltro(o, filtro)) return false
      if (filtroSiigo !== 'todos' && derivarEstadoSiigo(o).estado !== filtroSiigo) return false
      if (!q) return true
      const titulo = tituloOrdenDisplay(o).toLowerCase()
      const items = o.items
        .map(
          (i) =>
            `${i.codigo_producto} ${i.descripcion} ${i.proveedor_nombre ?? ''} ${i.observaciones ?? ''}`
        )
        .join(' ')
        .toLowerCase()
      const texto = `${titulo} ${o.observaciones_entrega ?? ''} ${items}`.toLowerCase()
      return texto.includes(q)
    })
  }, [ordenes, busqueda, filtro, filtroSiigo])

  const pendientes = filtradas.filter((o) => o.estado === 'en_curso')
  const otras = filtradas.filter((o) => o.estado !== 'en_curso')

  async function cambiarEstado(orden: OrdenCompra, estado: EstadoOrdenCompra) {
    // Las OC creadas a mano generan la factura de compra en Siigo, que exige el
    // número de la factura del proveedor: se pide antes de marcarlas listas.
    if (estado === 'listo' && orden.origen !== 'documento_siigo' && !orden.siigo_id) {
      setDialogoFactura({ orden, modo: 'listo' })
      return
    }
    const id = orden.id
    const res = await actualizarEstadoOrdenCompra(id, estado)
    if (res.ok) {
      if (estado === 'listo' && orden.origen === 'documento_siigo') {
        toast.success('Orden finalizada.')
      } else if (estado === 'listo') {
        toast.success('Orden finalizada. Enviando la factura de compra a Siigo…')
        // El envío a Siigo es asíncrono: se vuelve a consultar para mostrar el resultado.
        setTimeout(() => recargar(), 6000)
      } else {
        toast.success('Estado actualizado.')
      }
      recargar()
    } else {
      toast.error(res.error)
    }
  }

  async function handlePdf(orden: OrdenCompra) {
    descargarPdfOrdenCompra(orden)
    await marcarOrdenDescargadaSiigo(orden.id)
    toast.success('PDF generado. Súbelo a Siigo Nube cuando esté listo.')
    recargar()
  }

  async function handleCsv(orden: OrdenCompra) {
    descargarCsvSiigo([orden])
    await marcarOrdenDescargadaSiigo(orden.id)
    toast.success('CSV descargado.')
    recargar()
  }

  async function handleEnviarSiigo(orden: OrdenCompra, esReintento: boolean) {
    // Sin el número de la factura del proveedor Siigo rechaza el envío.
    if (!orden.factura_proveedor_numero?.trim()) {
      setDialogoFactura({ orden, modo: 'reintento' })
      return
    }
    setEnviandoSiigoId(orden.id)
    try {
      const res = esReintento ? await reintentarEnvioSiigo(orden.id) : await enviarOrdenASiigo(orden.id)
      if (res.ok) {
        toast.success('Orden enviada a Siigo.')
        recargar()
      } else {
        toast.error(res.error)
      }
    } finally {
      setEnviandoSiigoId(null)
    }
  }

  async function handleSubirDocumento(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setSubiendoDocumento(true)
    try {
      const formData = new FormData()
      formData.set('archivo', archivo)
      const res = await subirOrdenCompraDocumento(formData)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Orden ${res.numero} cargada. Queda pendiente de firma.`)
      if (res.sinCodigo.length > 0) {
        toast.warning(
          `Sin código en el catálogo (quedaron como SIN-CODIGO): ${res.sinCodigo.join(', ')}`
        )
      }
      recargar()
    } finally {
      setSubiendoDocumento(false)
    }
  }

  async function handleEliminar(id: number) {
    const res = await eliminarOrdenCompra(id)
    if (res.ok) {
      toast.success('Orden eliminada.')
      recargar()
    } else {
      toast.error(res.error)
    }
  }

  function abrirNueva() {
    setOrdenEditar(null)
    setDialogAbierto(true)
  }

  function abrirEditar(orden: OrdenCompra) {
    setOrdenEditar(orden)
    setDialogAbierto(true)
  }

  function alternar(id: number) {
    setAbiertas((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
  }

  function finalizar(orden: OrdenCompra) {
    const faltantes = orden.items.reduce((acc, i) => acc + resumenRecepcion(i).restante, 0)
    const lineas = orden.items.filter((i) => resumenRecepcion(i).restante > 0).length
    if (
      faltantes > 0 &&
      !window.confirm(
        `Aún faltan ${faltantes.toLocaleString('es-CO')} unidades por recibir en ${lineas} línea(s). ¿Finalizar de todos modos?`
      )
    ) {
      return
    }
    cambiarEstado(orden, 'listo')
  }

  function cancelar(orden: OrdenCompra) {
    if (!window.confirm('¿Cancelar esta orden de compra?')) return
    cambiarEstado(orden, 'cancelada')
  }

  function eliminar(orden: OrdenCompra) {
    if (!window.confirm('¿Eliminar esta orden? No se puede deshacer.')) return
    handleEliminar(orden.id)
  }

  function renderFilas(orden: OrdenCompra) {
    const abierta = abiertas.has(orden.id)
    const siigo = derivarEstadoSiigo(orden)
    const pedidas = orden.items.reduce((acc, i) => acc + Number(i.cantidad || 0), 0)
    const recibidas = orden.items.reduce((acc, i) => acc + Number(i.cantidad_recibida ?? 0), 0)
    const porcentaje = pedidas > 0 ? Math.min(100, Math.round((recibidas / pedidas) * 100)) : 0
    const proveedor = orden.items[0]?.proveedor_nombre ?? orden.proveedor_nombre
    const resumen =
      orden.items.length === 1
        ? orden.items[0].descripcion
        : `${orden.items.length} productos${proveedor ? ` · ${proveedor}` : ''}`

    return (
      <Fragment key={orden.id}>
        <TableRow
          data-state={abierta ? 'selected' : undefined}
          className="cursor-pointer"
          tabIndex={0}
          aria-expanded={abierta}
          onClick={() => alternar(orden.id)}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              alternar(orden.id)
            }
          }}
        >
          <TableCell className={cn('border-l-4 font-medium', BORDE_ESTADO[orden.estado])}>
            <div className="flex items-start gap-2">
              <ChevronRight
                aria-hidden
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                  abierta && 'rotate-90'
                )}
              />
              <div className="min-w-0">
                <p className="truncate">{tituloOrdenDisplay(orden)}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">{resumen}</p>
              </div>
            </div>
          </TableCell>
          <TableCell>
            <span
              className={cn(
                'inline-block whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold',
                CLASE_ESTADO_OC[orden.estado]
              )}
            >
              {ETIQUETA_ESTADO_OC[orden.estado]}
            </span>
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="w-32 space-y-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${porcentaje}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                {recibidas.toLocaleString('es-CO')} de {pedidas.toLocaleString('es-CO')}
              </p>
            </div>
          </TableCell>
          <TableCell className="hidden lg:table-cell">
            <SiigoStatusBadge estado={siigo.estado} />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="flex items-center gap-1.5 text-sm">
              {iconoVencimiento(orden)}
              <span className={textoEntrega(orden).clase}>{textoEntrega(orden).texto}</span>
            </div>
          </TableCell>
          <TableCell className="hidden lg:table-cell text-xs">
            {orden.documento_path ? (
              orden.firmada_at ? (
                <span className="font-medium text-emerald-700">Firmada</span>
              ) : (
                <span className="text-muted-foreground">Por firmar</span>
              )
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </TableCell>
        </TableRow>

        {abierta && (
          <TableRow className="bg-muted/20 hover:bg-muted/20">
            <TableCell colSpan={COLUMNAS} className="whitespace-normal px-4 py-3">
              <OrdenDetalle
                key={`${orden.id}-${orden.updated_at}`}
                orden={orden}
                puedeGestionar={puedeGestionarSiigo}
                puedeFirmar={puedeFirmar}
                enviandoSiigo={enviandoSiigoId === orden.id}
                onRecargar={recargar}
                onEditar={() => abrirEditar(orden)}
                onEliminar={() => eliminar(orden)}
                onFinalizar={() => finalizar(orden)}
                onCancelar={() => cancelar(orden)}
                onReabrir={() => cambiarEstado(orden, 'en_curso')}
                onPdf={() => handlePdf(orden)}
                onCsv={() => handleCsv(orden)}
                onEnviarSiigo={(esReintento) => handleEnviarSiigo(orden, esReintento)}
              />
            </TableCell>
          </TableRow>
        )}
      </Fragment>
    )
  }

  const encabezado = (
    <TableRow>
      <TableHead>Orden</TableHead>
      <TableHead>Estado</TableHead>
      <TableHead className="hidden md:table-cell">Avance</TableHead>
      <TableHead className="hidden lg:table-cell">Siigo</TableHead>
      <TableHead className="hidden md:table-cell">Entrega</TableHead>
      <TableHead className="hidden lg:table-cell">Firma</TableHead>
    </TableRow>
  )

  const conteo = (f: FiltroCompras) => ordenes.filter((o) => coincideFiltro(o, f)).length

  return (
    <div className="space-y-4">
      {!loading && ordenes.length > 0 && (
        <ResumenCompras ordenes={ordenes} filtro={filtro} onFiltro={setFiltro} />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={abrirNueva}>
            <Plus className="mr-1 h-4 w-4" />
            Agregar pedido
          </Button>
          {puedeGestionarSiigo && (
            <>
              <input
                ref={inputDocumentoRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={handleSubirDocumento}
              />
              <Button
                type="button"
                variant="outline"
                disabled={subiendoDocumento}
                onClick={() => inputDocumentoRef.current?.click()}
              >
                <Upload className="mr-1 h-4 w-4" />
                {subiendoDocumento ? 'Leyendo documento…' : 'Subir OC (PDF de Siigo)'}
              </Button>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar pedido, proveedor o producto..."
              className="pl-9"
            />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={filtroSiigo}
            onChange={(e) => setFiltroSiigo(e.target.value as typeof filtroSiigo)}
          >
            <option value="todos">Todos (Siigo)</option>
            {(Object.keys(ETIQUETA_SIIGO_SYNC) as EstadoSyncSiigo[]).map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_SIIGO_SYNC[e]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
        {CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={filtro === c.id}
            onClick={() => setFiltro(c.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filtro === c.id
                ? 'border-foreground bg-foreground text-background'
                : 'bg-card text-muted-foreground hover:bg-accent'
            )}
          >
            {c.etiqueta} <span className="tabular-nums opacity-70">{conteo(c.id)}</span>
          </button>
        ))}
        {filtro !== 'todas' && !CHIPS.some((c) => c.id === filtro) && (
          <button
            type="button"
            onClick={() => setFiltro('todas')}
            className="rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary hover:bg-primary/5"
          >
            Quitar filtro ✕
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Cargando pedidos">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
          {ordenes.length === 0 ? (
            <>Aún no hay órdenes de compra. Sube la de Siigo o agrega un pedido para empezar.</>
          ) : (
            <>
              Ninguna orden coincide con este filtro.{' '}
              <button
                type="button"
                className="font-medium text-primary underline"
                onClick={() => {
                  setFiltro('todas')
                  setBusqueda('')
                  setFiltroSiigo('todos')
                }}
              >
                Ver todas
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {pendientes.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <span aria-hidden="true" className="h-5 w-1.5 rounded-full bg-primary" />
                <h2 className="text-sm font-semibold text-foreground">Pendientes</h2>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    {encabezado}
                  </TableHeader>
                  <TableBody>
                    {pendientes.map(renderFilas)}
                    <TableRow className="hover:bg-muted/50">
                      <TableCell colSpan={COLUMNAS} className="p-0">
                        <button
                          type="button"
                          onClick={abrirNueva}
                          className="flex w-full items-center gap-1.5 px-2 py-2.5 text-left text-sm text-muted-foreground hover:text-foreground"
                        >
                          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                          Agregar pedido
                        </button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          {otras.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <span aria-hidden="true" className="h-5 w-1.5 rounded-full bg-muted-foreground/40" />
                <h2 className="text-sm font-semibold text-muted-foreground">Historial</h2>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    {encabezado}
                  </TableHeader>
                  <TableBody>{otras.map(renderFilas)}</TableBody>
                </Table>
              </div>
            </section>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Selecciona una orden para ver sus productos, registrar entregas, añadir datos o finalizarla.
        {productoInicial && (
          <>
            {' '}
            Producto desde inventario:{' '}
            <Link href="/inventario" className="underline">
              volver
            </Link>
          </>
        )}
      </p>

      <FacturaProveedorDialog
        orden={dialogoFactura?.orden ?? null}
        modo={dialogoFactura?.modo ?? 'listo'}
        onOpenChange={(abierto) => {
          if (!abierto) setDialogoFactura(null)
        }}
        onEnviada={() => {
          // El envío a Siigo es asíncrono: se vuelve a consultar para ver el resultado.
          recargar()
          setTimeout(() => recargar(), 6000)
        }}
      />

      <ComprasPedidoDialog
        abierto={dialogAbierto}
        onOpenChange={setDialogAbierto}
        ordenEditar={ordenEditar}
        productoInicial={productoInicial}
        onGuardado={recargar}
      />
    </div>
  )
}
