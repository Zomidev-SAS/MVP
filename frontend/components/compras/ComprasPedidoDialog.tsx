'use client'

import { useEffect } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
  guardarOrdenCompraPedidoSchema,
  itemVacio,
  type GuardarOrdenCompraPedidoInput,
  type OrdenCompra,
} from '@/lib/types/orden-compra'
import {
  actualizarOrdenCompraPedido,
  crearOrdenCompraPedido,
} from '@/lib/supabase/ordenes-compra-actions'
import { validarSiigoOrdenCompra } from '@/lib/supabase/siigo-actions'
import type { SiigoValidacionResultado } from '@/lib/types/siigo'
import { useState } from 'react'

interface ComprasPedidoDialogProps {
  abierto: boolean
  onOpenChange: (abierto: boolean) => void
  ordenEditar: OrdenCompra | null
  productoInicial?: { codigo: string; nombre: string } | null
  onGuardado: () => void
}

function hoyIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function valoresNueva(productoInicial?: { codigo: string; nombre: string } | null): GuardarOrdenCompraPedidoInput {
  const item = itemVacio()
  if (productoInicial) {
    item.codigo_producto = productoInicial.codigo
    item.nombre_producto = productoInicial.nombre
    item.descripcion = productoInicial.nombre
  }
  return {
    titulo: productoInicial ? `${productoInicial.nombre} OC` : '',
    fecha_pedido: hoyIso(),
    fecha_vencimiento: '',
    observaciones: '',
    observaciones_entrega: '',
    items: [item],
  }
}

function ordenToForm(orden: OrdenCompra): GuardarOrdenCompraPedidoInput {
  return {
    titulo: orden.titulo ?? '',
    fecha_pedido: orden.fecha_pedido,
    fecha_vencimiento: orden.fecha_vencimiento ?? '',
    observaciones: orden.observaciones ?? '',
    observaciones_entrega: orden.observaciones_entrega ?? '',
    items: orden.items.map((item) => ({
      codigo_producto: item.codigo_producto,
      nombre_producto: item.nombre_producto ?? '',
      cantidad: item.cantidad,
      cantidad_recibida: item.cantidad_recibida,
      descripcion: item.descripcion,
      proveedor_nit: item.proveedor_nit ?? '',
      proveedor_nombre: item.proveedor_nombre ?? '',
      proveedor_email: item.proveedor_email ?? '',
      observaciones: item.observaciones ?? '',
    })),
  }
}

export function ComprasPedidoDialog({
  abierto,
  onOpenChange,
  ordenEditar,
  productoInicial,
  onGuardado,
}: ComprasPedidoDialogProps) {
  const [validacionSiigo, setValidacionSiigo] = useState<SiigoValidacionResultado | null>(null)
  const [validandoSiigo, setValidandoSiigo] = useState(false)
  const [lineaValidando, setLineaValidando] = useState<number | null>(null)

  const form = useForm<GuardarOrdenCompraPedidoInput>({
    resolver: zodResolver(guardarOrdenCompraPedidoSchema),
    defaultValues: valoresNueva(productoInicial),
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  useEffect(() => {
    if (!abierto) return
    setValidacionSiigo(null)
    form.reset(ordenEditar ? ordenToForm(ordenEditar) : valoresNueva(productoInicial))
  }, [abierto, ordenEditar, productoInicial, form])

  async function onSubmit(datos: GuardarOrdenCompraPedidoInput) {
    const resultado = ordenEditar
      ? await actualizarOrdenCompraPedido(ordenEditar.id, datos)
      : await crearOrdenCompraPedido(datos)

    if (resultado.ok) {
      toast.success(ordenEditar ? 'Orden actualizada.' : 'Orden creada.')
      onOpenChange(false)
      onGuardado()
    } else {
      toast.error(resultado.error)
    }
  }

  async function handleValidarSiigo(indice: number) {
    const codigo = form.getValues(`items.${indice}.codigo_producto`)
    const nit = form.getValues(`items.${indice}.proveedor_nit`)
    setValidandoSiigo(true)
    setLineaValidando(indice)
    setValidacionSiigo(null)

    const res = await validarSiigoOrdenCompra({
      codigo_producto: codigo,
      proveedor_nit: nit || undefined,
    })

    setValidandoSiigo(false)
    setValidacionSiigo(res)

    if (!res.ok) {
      toast.error(res.error ?? 'Validación fallida.')
      return
    }

    if (res.producto?.encontrado && res.producto.name) {
      const descActual = form.getValues(`items.${indice}.descripcion`)
      if (!descActual) form.setValue(`items.${indice}.descripcion`, res.producto.name)
      if (!form.getValues(`items.${indice}.nombre_producto`)) {
        form.setValue(`items.${indice}.nombre_producto`, res.producto.name)
      }
    }
    if (res.proveedor?.encontrado && res.proveedor.name) {
      if (!form.getValues(`items.${indice}.proveedor_nombre`)) {
        form.setValue(`items.${indice}.proveedor_nombre`, res.proveedor.name)
      }
    }
    toast.success('Validación Siigo completada.')
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{ordenEditar ? 'Editar orden de compra' : 'Nueva orden de compra'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre / tarea</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. COAUTOPARTES OC 3674" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="fecha_pedido"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha pedido</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fecha_vencimiento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vencimiento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Productos y proveedores</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append(itemVacio())}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Agregar línea
                </Button>
              </div>

              {fields.map((field, indice) => (
                <div key={field.id} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Línea {indice + 1}</span>
                    {fields.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(indice)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`items.${indice}.codigo_producto`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>Código producto</FormLabel>
                          <FormControl>
                            <Input {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${indice}.cantidad`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>Cantidad pedida</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0.01}
                              step="any"
                              value={f.value}
                              onChange={(e) => f.onChange(e.target.valueAsNumber || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name={`items.${indice}.descripcion`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Input {...f} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-2 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`items.${indice}.proveedor_nit`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>Proveedor NIT</FormLabel>
                          <FormControl>
                            <Input {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${indice}.proveedor_nombre`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>Proveedor nombre</FormLabel>
                          <FormControl>
                            <Input {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`items.${indice}.cantidad_recibida`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>Cant. recibida (opcional)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={f.value ?? ''}
                              onChange={(e) => {
                                const v = e.target.value
                                f.onChange(v === '' ? null : e.target.valueAsNumber)
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${indice}.proveedor_email`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>Email proveedor</FormLabel>
                          <FormControl>
                            <Input type="email" {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name={`items.${indice}.observaciones`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel>Obs. línea (ej. entrega parcial)</FormLabel>
                        <FormControl>
                          <Input placeholder="Llegaron 200 de 1000 tornillos" {...f} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={validandoSiigo}
                    onClick={() => handleValidarSiigo(indice)}
                  >
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    {validandoSiigo && lineaValidando === indice ? 'Validando...' : 'Validar Siigo'}
                  </Button>
                </div>
              ))}
            </div>

            {validacionSiigo?.ok && (
              <ul className="space-y-1 rounded-md border bg-muted/40 p-2 text-xs">
                <li className={validacionSiigo.producto?.encontrado ? 'text-green-700' : 'text-destructive'}>
                  Producto:{' '}
                  {validacionSiigo.producto?.encontrado
                    ? `${validacionSiigo.producto.code} — ${validacionSiigo.producto.name}`
                    : 'No encontrado'}
                </li>
                {validacionSiigo.proveedor != null && (
                  <li className={validacionSiigo.proveedor.encontrado ? 'text-green-700' : 'text-destructive'}>
                    Proveedor:{' '}
                    {validacionSiigo.proveedor.encontrado
                      ? `${validacionSiigo.proveedor.identification} — ${validacionSiigo.proveedor.name}`
                      : 'No encontrado'}
                  </li>
                )}
              </ul>
            )}

            <FormField
              control={form.control}
              name="observaciones_entrega"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Texto / seguimiento de entregas</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Ej. Llegaron 100 tornillos de 1000 — PEDIDO ENTREGADO COMPLETO"
                      {...field}
                    />
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
                  <FormLabel>Notas internas</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando...' : ordenEditar ? 'Guardar cambios' : 'Crear orden'}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
