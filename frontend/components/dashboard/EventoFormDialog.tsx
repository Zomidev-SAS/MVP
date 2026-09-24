'use client'

import { useEffect } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2, Check } from 'lucide-react'
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
  guardarEventoSchema,
  type CalendarEvento,
  type GuardarEventoInput,
} from '@/lib/types/calendario'
import { actualizarEvento, crearEvento, eliminarEvento } from '@/lib/supabase/calendario-actions'

interface EventoFormDialogProps {
  abierto: boolean
  onOpenChange: (abierto: boolean) => void
  evento: CalendarEvento | null
  fechaInicial: string
  onGuardado: () => void
}

function valoresIniciales(evento: CalendarEvento | null, fechaInicial: string): GuardarEventoInput {
  if (evento) {
    return {
      fecha: evento.fecha,
      fecha_fin: evento.fecha_fin,
      titulo: evento.titulo,
      nota: evento.nota ?? '',
      fechas_adicionales: evento.fechas_adicionales,
      secciones: evento.secciones.map((s) => ({
        id: s.id,
        titulo: s.titulo,
        completada: s.completada,
      })),
    }
  }
  return {
    fecha: fechaInicial,
    fecha_fin: null,
    titulo: '',
    nota: '',
    fechas_adicionales: [],
    secciones: [],
  }
}

export function EventoFormDialog({
  abierto,
  onOpenChange,
  evento,
  fechaInicial,
  onGuardado,
}: EventoFormDialogProps) {
  const esEdicion = evento !== null

  const form = useForm<GuardarEventoInput>({
    resolver: zodResolver(guardarEventoSchema),
    defaultValues: valoresIniciales(evento, fechaInicial),
  })

  const { fields: secciones, append: agregarSeccion, remove: quitarSeccion } = useFieldArray({
    control: form.control,
    name: 'secciones',
  })

  const fechasAdicionales = form.watch('fechas_adicionales')
  const fechaFin = form.watch('fecha_fin')
  const usarRango = fechaFin != null && fechaFin !== ''

  useEffect(() => {
    if (abierto) {
      form.reset(valoresIniciales(evento, fechaInicial))
    }
  }, [abierto, evento, fechaInicial, form])

  async function onSubmit(datos: GuardarEventoInput) {
    const payload: GuardarEventoInput = {
      ...datos,
      fecha_fin: usarRango ? datos.fecha_fin : null,
      nota: datos.nota.trim(),
      fechas_adicionales: datos.fechas_adicionales.filter(Boolean),
      secciones: datos.secciones.filter((s) => s.titulo.trim()),
    }

    const resultado = esEdicion
      ? await actualizarEvento(evento.id, payload)
      : await crearEvento(payload)

    if (resultado.ok) {
      toast.success(esEdicion ? 'Evento actualizado.' : 'Evento agregado.')
      onOpenChange(false)
      onGuardado()
    } else {
      toast.error(resultado.error)
    }
  }

  async function handleBorrar() {
    if (!evento) return
    const resultado = await eliminarEvento(evento.id)
    if (resultado.ok) {
      toast.success('Evento borrado.')
      onOpenChange(false)
      onGuardado()
    } else {
      toast.error(resultado.error)
    }
  }

  function agregarFechaExtra() {
    const actuales = form.getValues('fechas_adicionales')
    form.setValue('fechas_adicionales', [...actuales, form.getValues('fecha')])
  }

  function quitarFechaExtra(index: number) {
    const actuales = form.getValues('fechas_adicionales')
    form.setValue(
      'fechas_adicionales',
      actuales.filter((_, i) => i !== index)
    )
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{esEdicion ? 'Editar evento' : 'Nuevo evento'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Reunión con proveedor" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nota"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detalles, notas o recordatorios..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Fechas</p>
              <FormField
                control={form.control}
                name="fecha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{usarRango ? 'Fecha inicio' : 'Fecha'}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={usarRango}
                  onChange={(e) => {
                    if (e.target.checked) {
                      form.setValue('fecha_fin', form.getValues('fecha'))
                    } else {
                      form.setValue('fecha_fin', null)
                    }
                  }}
                  className="h-4 w-4 rounded border"
                />
                Usar rango de fechas
              </label>

              {usarRango && (
                <FormField
                  control={form.control}
                  name="fecha_fin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha fin</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value ?? ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel className="text-sm">Fechas adicionales</FormLabel>
                  <Button type="button" variant="outline" size="sm" onClick={agregarFechaExtra}>
                    <Plus className="mr-1 h-3 w-3" />
                    Agregar fecha
                  </Button>
                </div>
                {fechasAdicionales.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Repite el evento en otras fechas específicas (como recordatorios de iPhone).
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {fechasAdicionales.map((_, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <FormField
                          control={form.control}
                          name={`fechas_adicionales.${index}`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => quitarFechaExtra(index)}
                          aria-label="Quitar fecha"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Secciones</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => agregarSeccion({ titulo: '', completada: false })}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Agregar sección
                </Button>
              </div>
              {secciones.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Divide el evento en pasos o subtareas, como en Recordatorios.
                </p>
              ) : (
                <ul className="space-y-2">
                  {secciones.map((field, index) => (
                    <li key={field.id} className="flex items-center gap-2">
                      <FormField
                        control={form.control}
                        name={`secciones.${index}.completada`}
                        render={({ field: checkField }) => (
                          <button
                            type="button"
                            onClick={() => checkField.onChange(!checkField.value)}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              checkField.value
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-muted-foreground'
                            }`}
                            aria-label={checkField.value ? 'Marcar pendiente' : 'Marcar completada'}
                          >
                            {checkField.value && <Check className="h-3 w-3" />}
                          </button>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`secciones.${index}.titulo`}
                        render={({ field: tituloField }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                placeholder="Nombre de la sección"
                                {...tituloField}
                                className={form.watch(`secciones.${index}.completada`) ? 'line-through opacity-60' : ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => quitarSeccion(index)}
                        aria-label="Quitar sección"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear evento'}
              </Button>
              {esEdicion && (
                <Button type="button" variant="destructive" onClick={handleBorrar}>
                  Borrar
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
