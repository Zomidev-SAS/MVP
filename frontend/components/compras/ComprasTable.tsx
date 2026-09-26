'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  ESTADOS_ORDEN_COMPRA,
  ETIQUETA_ESTADO_OC,
  tituloOrdenDisplay,
  type EstadoOrdenCompra,
  type OrdenCompra,
} from '@/lib/types/orden-compra'
import {
  actualizarEstadoOrdenCompra,
  actualizarObservacionesEntrega,
  eliminarOrdenCompra,
  fetchOrdenesCompra,
  marcarOrdenDescargadaSiigo,
} from '@/lib/supabase/ordenes-compra-actions'
import { descargarCsvSiigo } from '@/lib/export/orden-compra-siigo'
import { descargarPdfOrdenCompra } from '@/lib/export/orden-compra-pdf'
import { ComprasPedidoDialog } from '@/components/compras/ComprasPedidoDialog'

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
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vence = new Date(orden.fecha_vencimiento + 'T12:00:00')
  if (vence < hoy) {
    return <AlertCircle className="h-4 w-4 text-destructive" aria-hidden />
  }
  return <Clock className="h-4 w-4 text-amber-600" aria-hidden />
}

interface ComprasTableProps {
  productoInicial?: { codigo: string; nombre: string } | null
}

export function ComprasTable({ productoInicial }: ComprasTableProps) {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | EstadoOrdenCompra>('todos')
  const [dialogAbierto, setDialogAbierto] = useState(Boolean(productoInicial))
  const [ordenEditar, setOrdenEditar] = useState<OrdenCompra | null>(null)
  const [editandoTextoId, setEditandoTextoId] = useState<number | null>(null)
  const [textoEntrega, setTextoEntrega] = useState('')

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
      if (filtroEstado !== 'todos' && o.estado !== filtroEstado) return false
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
  }, [ordenes, busqueda, filtroEstado])

  const pendientes = filtradas.filter((o) => o.estado === 'en_curso')
  const otras = filtradas.filter((o) => o.estado !== 'en_curso')

  async function cambiarEstado(id: number, estado: EstadoOrdenCompra) {
    const res = await actualizarEstadoOrdenCompra(id, estado)
    if (res.ok) {
      toast.success('Estado actualizado.')
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

  async function guardarTextoEntrega(id: number) {
    const res = await actualizarObservacionesEntrega(id, textoEntrega)
    if (res.ok) {
      toast.success('Texto guardado.')
      setEditandoTextoId(null)
      recargar()
    } else {
      toast.error(res.error)
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

  function renderFila(orden: OrdenCompra) {
    const resumenItems =
      orden.items.length === 1
        ? `${orden.items[0].cantidad} uds · ${orden.items[0].codigo_producto}`
        : `${orden.items.length} líneas · ${orden.items.map((i) => i.proveedor_nombre).filter(Boolean).slice(0, 2).join(', ')}`

    return (
      <TableRow key={orden.id}>
        <TableCell className="font-medium">
          <div>
            <p>{tituloOrdenDisplay(orden)}</p>
            <p className="text-xs text-muted-foreground">{resumenItems}</p>
          </div>
        </TableCell>
        <TableCell>
          <select
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium',
              CLASE_ESTADO_OC[orden.estado]
            )}
            value={orden.estado}
            onChange={(e) => cambiarEstado(orden.id, e.target.value as EstadoOrdenCompra)}
          >
            {ESTADOS_ORDEN_COMPRA.map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_ESTADO_OC[e]}
              </option>
            ))}
          </select>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5 text-sm">
            {iconoVencimiento(orden)}
            <span>{formatearVencimiento(orden.fecha_vencimiento)}</span>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="outline" size="sm" onClick={() => handlePdf(orden)}>
              <FileText className="mr-1 h-3 w-3 text-red-600" />
              PDF
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => handleCsv(orden)}>
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
        <TableCell className="max-w-[220px]">
          {editandoTextoId === orden.id ? (
            <div className="space-y-1">
              <Textarea
                rows={2}
                value={textoEntrega}
                onChange={(e) => setTextoEntrega(e.target.value)}
                placeholder="Ej. Llegaron 100 tornillos de 1000"
                className="text-xs"
              />
              <div className="flex gap-1">
                <Button type="button" size="sm" onClick={() => guardarTextoEntrega(orden.id)}>
                  Guardar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditandoTextoId(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="w-full text-left text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setEditandoTextoId(orden.id)
                setTextoEntrega(orden.observaciones_entrega ?? '')
              }}
            >
              {orden.observaciones_entrega?.trim() || 'Click para anotar entregas...'}
            </button>
          )}
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            {orden.estado === 'en_curso' && (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => abrirEditar(orden)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleEliminar(orden.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" onClick={abrirNueva}>
          <Plus className="mr-1 h-4 w-4" />
          Agregar pedido
        </Button>
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
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
          >
            <option value="todos">Todos los estados</option>
            {ESTADOS_ORDEN_COMPRA.map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_ESTADO_OC[e]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando pedidos...</p>
      ) : filtradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay órdenes de compra.</p>
      ) : (
        <div className="space-y-6">
          {pendientes.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-primary">Pendientes</h2>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarea</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead>Archivo</TableHead>
                      <TableHead>Texto</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>{pendientes.map(renderFila)}</TableBody>
                </Table>
              </div>
            </section>
          )}

          {otras.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Historial</h2>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarea</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead>Archivo</TableHead>
                      <TableHead>Texto</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>{otras.map(renderFila)}</TableBody>
                </Table>
              </div>
            </section>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Genera el PDF al completar los datos y súbelo a Siigo Nube. También puedes descargar CSV.
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
