'use client'

import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Download, Pencil, Plus, Send, Trash2, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  guardarOrdenCompraSchema,
  ETIQUETA_DESTINO,
  ETIQUETA_ESTADO_OC,
  type GuardarOrdenCompraInput,
  type OrdenCompra,
} from '@/lib/types/orden-compra'
import {
  actualizarOrdenCompra,
  cancelarOrdenCompra,
  crearOrdenCompra,
  eliminarOrdenCompra,
  enviarOrdenCompra,
  fetchOrdenesCompraProducto,
  finalizarOrdenCompra,
  marcarOrdenDescargadaSiigo,
} from '@/lib/supabase/ordenes-compra-actions'
import { descargarCsvSiigo } from '@/lib/export/orden-compra-siigo'
import { validarSiigoOrdenCompra } from '@/lib/supabase/siigo-actions'
import type { InventarioItem } from '@/lib/types/inventario'
import type { SiigoValidacionResultado } from '@/lib/types/siigo'

interface OrdenCompraDialogProps {
  producto: InventarioItem | null
  abierto: boolean
  onOpenChange: (abierto: boolean) => void
}

function hoyIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function valoresNuevaOrden(producto: InventarioItem): GuardarOrdenCompraInput {
  return {
    codigo_producto: producto.codigo_producto,
    nombre_producto: producto.nombre_producto ?? '',
    fecha_pedido: hoyIso(),
    cantidad: 1,
    descripcion: producto.nombre_producto ?? producto.codigo_producto,
    proveedor_nit: '',
    proveedor_nombre: '',
    proveedor_email: '',
    destino_envio: 'compras',
    observaciones: '',
  }
}

function ordenToForm(orden: OrdenCompra): GuardarOrdenCompraInput {
  return {
    codigo_producto: orden.codigo_producto,
    nombre_producto: orden.nombre_producto ?? '',
    fecha_pedido: orden.fecha_pedido,
    cantidad: orden.cantidad,
    descripcion: orden.descripcion,
    proveedor_nit: orden.proveedor_nit ?? '',
    proveedor_nombre: orden.proveedor_nombre ?? '',
    proveedor_email: orden.proveedor_email ?? '',
    destino_envio: orden.destino_envio,
    observaciones: orden.observaciones ?? '',
  }
}

export function OrdenCompraDialog({ producto, abierto, onOpenChange }: OrdenCompraDialogProps) {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [loading, setLoading] = useState(false)
  const [modo, setModo] = useState<'lista' | 'form'>('lista')
  const [editando, setEditando] = useState<OrdenCompra | null>(null)
  const [finalizandoId, setFinalizandoId] = useState<number | null>(null)
  const [referenciaSiigo, setReferenciaSiigo] = useState('')
  const [validacionSiigo, setValidacionSiigo] = useState<SiigoValidacionResultado | null>(null)
  const [validandoSiigo, setValidandoSiigo] = useState(false)

  const form = useForm<GuardarOrdenCompraInput>({
    resolver: zodResolver(guardarOrdenCompraSchema),
    defaultValues: producto ? valoresNuevaOrden(producto) : undefined,
  })

  const recargar = useCallback(async () => {
    if (!producto) return
    setLoading(true)
    try {
      setOrdenes(await fetchOrdenesCompraProducto(producto.codigo_producto))
    } finally {
      setLoading(false)
    }
  }, [producto])

  useEffect(() => {
    if (abierto && producto) {
      setModo('lista')
      setEditando(null)
      setFinalizandoId(null)
      setValidacionSiigo(null)
      recargar()
    }
  }, [abierto, producto, recargar])

  useEffect(() => {
    if (modo === 'form' && producto) {
      form.reset(editando ? ordenToForm(editando) : valoresNuevaOrden(producto))
    }
  }, [modo, editando, producto, form])

  if (!producto) return null

  async function onSubmit(datos: GuardarOrdenCompraInput) {
    const resultado = editando
      ? await actualizarOrdenCompra(editando.id, datos)
      : await crearOrdenCompra(datos)

    if (resultado.ok) {
      toast.success(editando ? 'Orden actualizada.' : 'Orden creada.')
      setModo('lista')
      setEditando(null)
      recargar()
    } else {
      toast.error(resultado.error)
    }
  }

  async function handleEnviar(id: number) {
    const res = await enviarOrdenCompra(id)
    if (res.ok) {
      toast.success('Orden enviada al área de compras.')
      recargar()
    } else {
      toast.error(res.error)
    }
  }

  async function handleDescargar(orden: OrdenCompra) {
    descargarCsvSiigo([orden])
    const res = await marcarOrdenDescargadaSiigo(orden.id)
    if (res.ok) {
      toast.success('CSV descargado. Súbelo o transcribe los datos en Siigo Nube.')
      recargar()
    }
  }

  async function handleFinalizar(id: number) {
    const res = await finalizarOrdenCompra(id, referenciaSiigo)
    if (res.ok) {
      toast.success('Orden finalizada.')
      setFinalizandoId(null)
      setReferenciaSiigo('')
      recargar()
    } else {
      toast.error(res.error)
    }
  }

  async function handleCancelar(id: number) {
    const res = await cancelarOrdenCompra(id)
    if (res.ok) {
      toast.success('Orden cancelada.')
      recargar()
    } else {
      toast.error(res.error)
    }
  }

  async function handleValidarSiigo() {
    if (!producto) return
    setValidandoSiigo(true)
    setValidacionSiigo(null)
    const nit = form.getValues('proveedor_nit')
    const res = await validarSiigoOrdenCompra({
      codigo_producto: producto.codigo_producto,
      proveedor_nit: nit || undefined,
    })
    setValidandoSiigo(false)
    setValidacionSiigo(res)
    if (!res.ok) {
      toast.error(res.error ?? 'Validación fallida.')
      return
    }
    if (res.producto?.encontrado && res.producto.name && !form.getValues('descripcion')) {
      form.setValue('descripcion', res.producto.name)
    }
    if (res.proveedor?.encontrado && res.proveedor.name && !form.getValues('proveedor_nombre')) {
      form.setValue('proveedor_nombre', res.proveedor.name)
    }
    toast.success('Validación Siigo completada.')
  }

  async function handleBorrar(id: number) {
    const res = await eliminarOrdenCompra(id)
    if (res.ok) {
      toast.success('Orden borrada.')
      recargar()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Orden de compra — {producto.codigo_producto}</DialogTitle>
        </DialogHeader>

        {modo === 'lista' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Crea la orden aquí una sola vez, descárgala para Siigo y finaliza cuando esté cargada
              en Nube.
            </p>
            <Button type="button" size="sm" onClick={() => { setEditando(null); setModo('form') }}>
              <Plus className="mr-1 h-4 w-4" />
              Nueva orden
            </Button>

            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : ordenes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin órdenes para este producto.</p>
            ) : (
              <ul className="space-y-3">
                {ordenes.map((orden) => (
                  <li key={orden.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          #{orden.id} · {ETIQUETA_ESTADO_OC[orden.estado]}
                        </p>
                        <p className="text-xs text-muted-foreground">{orden.fecha_pedido}</p>
                      </div>
                      <span className="shrink-0 text-sm font-medium">{orden.cantidad} uds</span>
                    </div>
                    <p className="mt-1 text-sm">{orden.descripcion}</p>
                    {orden.proveedor_nombre && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Proveedor: {orden.proveedor_nombre}
                        {orden.proveedor_nit ? ` (${orden.proveedor_nit})` : ''}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Envío: {ETIQUETA_DESTINO[orden.destino_envio]}
                    </p>
                    {orden.descargada_siigo_at && (
                      <p className="text-xs text-muted-foreground">
                        Descargada:{' '}
                        {new Date(orden.descargada_siigo_at).toLocaleString('es-CO')}
                      </p>
                    )}
                    {orden.siigo_referencia && (
                      <p className="text-xs text-muted-foreground">
                        Ref. Siigo: {orden.siigo_referencia}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1">
                      {orden.estado === 'borrador' && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => { setEditando(orden); setModo('form') }}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            Editar
                          </Button>
                          <Button type="button" size="sm" onClick={() => handleEnviar(orden.id)}>
                            <Send className="mr-1 h-3 w-3" />
                            Enviar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleBorrar(orden.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      {orden.estado === 'enviada' && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => { setEditando(orden); setModo('form') }}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleDescargar(orden)}
                          >
                            <Download className="mr-1 h-3 w-3" />
                            Descargar para Siigo
                          </Button>
                          {finalizandoId === orden.id ? (
                            <div className="flex w-full flex-wrap items-end gap-2 pt-1">
                              <div className="flex-1">
                                <label className="text-xs text-muted-foreground">
                                  Nº OC en Siigo (opcional)
                                </label>
                                <Input
                                  value={referenciaSiigo}
                                  onChange={(e) => setReferenciaSiigo(e.target.value)}
                                  placeholder="Ej. OC-12-45"
                                  className="h-8 text-sm"
                                />
                              </div>
                              <Button type="button" size="sm" onClick={() => handleFinalizar(orden.id)}>
                                Confirmar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => { setFinalizandoId(null); setReferenciaSiigo('') }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setFinalizandoId(orden.id)}
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Finalizar
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelar(orden.id)}
                          >
                            Cancelar orden
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="fecha_pedido"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>¿Qué se pidió?</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cantidad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuánto</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0.01}
                        step="any"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="proveedor_nit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proveedor NIT</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="proveedor_nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proveedor nombre</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="proveedor_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email proveedor (opcional)</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Siigo Nube</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={validandoSiigo}
                    onClick={handleValidarSiigo}
                  >
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    {validandoSiigo ? 'Validando...' : 'Validar producto/proveedor'}
                  </Button>
                </div>
                {validacionSiigo?.ok && (
                  <ul className="space-y-1 text-xs">
                    <li className={validacionSiigo.producto?.encontrado ? 'text-green-700' : 'text-destructive'}>
                      Producto:{' '}
                      {validacionSiigo.producto?.encontrado
                        ? `${validacionSiigo.producto.code} — ${validacionSiigo.producto.name}`
                        : 'No encontrado en Siigo'}
                    </li>
                    {validacionSiigo.proveedor != null && (
                      <li className={validacionSiigo.proveedor.encontrado ? 'text-green-700' : 'text-destructive'}>
                        Proveedor:{' '}
                        {validacionSiigo.proveedor.encontrado
                          ? `${validacionSiigo.proveedor.identification} — ${validacionSiigo.proveedor.name}`
                          : 'No encontrado en Siigo'}
                      </li>
                    )}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">
                  La OC se crea en el panel; Siigo recibe el CSV al descargar. Esta validación evita errores al cargar en Nube.
                </p>
              </div>
              <FormField
                control={form.control}
                name="destino_envio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enviar a</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        value={field.value}
                        onChange={field.onChange}
                      >
                        <option value="compras">Área de compras</option>
                        <option value="proveedor">Proveedor (registro; email próximamente)</option>
                        <option value="ambos">Compras y proveedor</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="observaciones"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Guardando...' : editando ? 'Guardar' : 'Crear'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setModo('lista'); setEditando(null) }}>
                  Volver
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
