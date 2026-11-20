'use client'

import { useEffect, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Download } from 'lucide-react'
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
  descargarCsvResultadoOc,
  descargarPdfResultadoOc,
  type ProveedorExportable,
} from '@/lib/export/proveedor-desempeno'
import {
  CALIDADES,
  ETIQUETA_CALIDAD,
  calcularPuntajes,
  type Calidad,
  type ConfigDesempeno,
} from '@/lib/proveedores/desempeno'
import { formatearFechaCorta } from '@/lib/proveedores/fechas'
import {
  CLASE_PUNTO_NIVEL,
  formatearEntero,
  formatearPorcentaje,
  nivelCumplimiento,
} from '@/lib/proveedores/formato'
import { etiquetaOrden, seCalifica, type FilaHistorial } from '@/lib/proveedores/historial'
import { guardarDesempeno } from '@/lib/supabase/proveedor-desempeno-actions'
import {
  guardarDesempenoSchema,
  type GuardarDesempenoInput,
} from '@/lib/types/proveedor-desempeno'
import { cn } from '@/lib/utils'

const SELECT_CLASS =
  'flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

interface DesempenoDialogProps {
  abierto: boolean
  onOpenChange: (abierto: boolean) => void
  fila: FilaHistorial | null
  proveedorId: number
  proveedor: ProveedorExportable
  config: ConfigDesempeno
  onGuardado: () => void
}

/** Solo lo que difiere de la OC es una sobrescritura; lo demás se deja vacío para que siga a la OC. */
function sobrescritura(valor: string | null, derivado: string | null): string {
  return valor != null && valor !== derivado ? valor : ''
}

function valoresIniciales(fila: FilaHistorial | null): GuardarDesempenoInput {
  return {
    calidad: fila?.calidad ?? null,
    calidad_comentario: fila?.calidad_comentario ?? '',
    devoluciones: fila?.devoluciones ?? 0,
    devoluciones_detalle: fila?.devoluciones_detalle ?? '',
    cantidad_observaciones: fila?.cantidad_observaciones ?? '',
    pagos_acordados: fila?.pagos_acordados ?? '',
    tiempo_observaciones: fila?.tiempo_observaciones ?? '',
    observaciones: fila?.observaciones ?? '',
    fecha_entrega_prometida: fila
      ? sobrescritura(fila.fecha_entrega_prometida, fila.derivado.fecha_entrega_prometida)
      : '',
    fecha_entrega_real: fila
      ? sobrescritura(fila.fecha_entrega_real, fila.derivado.fecha_entrega_real)
      : '',
    factura_remision: fila ? sobrescritura(fila.factura_remision, fila.derivado.factura_remision) : '',
  }
}

function Puntaje({ valor }: { valor: number | null }) {
  return (
    <span className="text-sm tabular-nums text-muted-foreground">
      {valor == null ? 'No aplica' : formatearPorcentaje(valor)}
    </span>
  )
}

function Division({
  titulo,
  puntaje,
  children,
}: {
  titulo: string
  puntaje: number | null
  children: ReactNode
}) {
  return (
    <fieldset className="space-y-3 rounded-md border p-3">
      <legend className="sr-only">{titulo}</legend>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{titulo}</p>
        <Puntaje valor={puntaje} />
      </div>
      {children}
    </fieldset>
  )
}

function DeLaOrden({ valor }: { valor: string | null }) {
  return (
    <p className="text-xs text-muted-foreground">
      Según la orden: {valor ?? 'sin dato'}. Déjalo vacío para usar ese valor.
    </p>
  )
}

export function DesempenoDialog({
  abierto,
  onOpenChange,
  fila,
  proveedorId,
  proveedor,
  config,
  onGuardado,
}: DesempenoDialogProps) {
  const form = useForm<GuardarDesempenoInput>({
    resolver: zodResolver(guardarDesempenoSchema),
    defaultValues: valoresIniciales(fila),
  })

  useEffect(() => {
    if (abierto) form.reset(valoresIniciales(fila))
  }, [abierto, fila, form])

  const valores = useWatch({ control: form.control })

  if (!fila) return null

  const esHistorica = fila.estado === 'historico'
  const prometida = valores.fecha_entrega_prometida || fila.derivado.fecha_entrega_prometida
  const real = valores.fecha_entrega_real || fila.derivado.fecha_entrega_real
  const enVivo = calcularPuntajes(
    {
      calidad: (valores.calidad ?? null) as Calidad | null,
      devoluciones: Number.isFinite(valores.devoluciones) ? Number(valores.devoluciones) : 0,
      cantidadPedida: fila.cantidad_pedida,
      cantidadRecibida: fila.cantidad_recibida,
      fechaPrometida: prometida,
      fechaReal: real,
    },
    config
  )
  const califica = seCalifica(fila.estado)
  const global = califica ? enVivo.global : null

  async function onSubmit(datos: GuardarDesempenoInput) {
    if (!fila) return
    const resultado = await guardarDesempeno(
      proveedorId,
      fila.orden_id,
      fila.orden_id == null ? fila.numero_oc : null,
      datos
    )
    if (resultado.ok) {
      toast.success('Desempeño guardado.')
      onOpenChange(false)
      onGuardado()
    } else {
      toast.error(resultado.error)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Desempeño · {etiquetaOrden(fila)}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {proveedor.nombre}
            {fila.fecha_oc && <> · Orden del {formatearFechaCorta(fila.fecha_oc)}</>}
          </p>
        </DialogHeader>

        <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
          <div>
            <p className="text-xs text-muted-foreground">Cumplimiento</p>
            <p className="flex items-center gap-2 text-3xl font-semibold tabular-nums">
              {global != null && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    CLASE_PUNTO_NIVEL[nivelCumplimiento(global, config.umbral)]
                  )}
                />
              )}
              {global == null ? '—' : formatearPorcentaje(global)}
            </p>
            <p className="text-xs text-muted-foreground">
              {califica
                ? `Se aprueba desde ${formatearPorcentaje(config.umbral)}`
                : 'Se califica cuando la orden se finalice. Ya puedes ir registrando.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => descargarCsvResultadoOc(proveedor, fila)}
            >
              <Download aria-hidden="true" />
              CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => descargarPdfResultadoOc(proveedor, fila, config)}
            >
              <Download aria-hidden="true" />
              PDF
            </Button>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Division titulo="Calidad" puntaje={enVivo.calidad}>
                <FormField
                  control={form.control}
                  name="calidad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">¿Cómo llegó el pedido?</FormLabel>
                      <FormControl>
                        <select
                          className={SELECT_CLASS}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value === '' ? null : (e.target.value as Calidad))
                          }
                        >
                          <option value="">Sin evaluar</option>
                          {CALIDADES.map((c) => (
                            <option key={c} value={c}>
                              {ETIQUETA_CALIDAD[c]}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="calidad_comentario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Comentario</FormLabel>
                      <FormControl>
                        <Textarea rows={2} placeholder="Estado del material, piezas con falla..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </Division>

              <Division titulo="Devoluciones" puntaje={enVivo.devoluciones}>
                <FormField
                  control={form.control}
                  name="devoluciones"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Cantidad de devoluciones</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className="w-28"
                          value={Number.isFinite(field.value) ? field.value : ''}
                          onChange={(e) =>
                            field.onChange(e.target.value === '' ? 0 : Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="devoluciones_detalle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">¿Qué se devolvió y por qué?</FormLabel>
                      <FormControl>
                        <Textarea rows={2} placeholder="Llegó mal, retraso, el cliente desistió..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </Division>

              <Division titulo="Cantidad" puntaje={enVivo.cantidad}>
                <p className="text-sm">
                  {fila.cantidad_pedida == null ? (
                    <span className="text-muted-foreground">Esta orden no tiene cantidades registradas.</span>
                  ) : (
                    <>
                      Recibido{' '}
                      <span className="font-medium tabular-nums">
                        {formatearEntero(fila.cantidad_recibida ?? 0)}
                      </span>{' '}
                      de <span className="tabular-nums">{formatearEntero(fila.cantidad_pedida)}</span>
                      {!esHistorica && <span className="text-muted-foreground"> · según las entregas en Compras</span>}
                    </>
                  )}
                </p>
                <FormField
                  control={form.control}
                  name="pagos_acordados"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Pagos acordados</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. 2 pagos" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cantidad_observaciones"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Observaciones</FormLabel>
                      <FormControl>
                        <Textarea rows={2} placeholder="Llegó incompleto, faltó una referencia..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </Division>

              <Division titulo="Tiempo" puntaje={enVivo.tiempo}>
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="fecha_entrega_prometida"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Entrega prometida</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fecha_entrega_real"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Entrega real</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {!esHistorica && (
                  <DeLaOrden
                    valor={[
                      formatearFechaCorta(fila.derivado.fecha_entrega_prometida),
                      formatearFechaCorta(fila.derivado.fecha_entrega_real),
                    ]
                      .map((v) => v ?? 'sin fecha')
                      .join(' → ')}
                  />
                )}
                <p className="text-sm">
                  {enVivo.diferenciaDias == null ? (
                    <span className="text-muted-foreground">Sin las dos fechas no se mide el tiempo.</span>
                  ) : enVivo.diferenciaDias > 0 ? (
                    <span className="font-medium text-[var(--warning)]">
                      {enVivo.diferenciaDias} {enVivo.diferenciaDias === 1 ? 'día' : 'días'} de retraso
                    </span>
                  ) : enVivo.diferenciaDias < 0 ? (
                    <>Llegó {Math.abs(enVivo.diferenciaDias)} días antes</>
                  ) : (
                    <>Llegó el día prometido</>
                  )}
                </p>
                <FormField
                  control={form.control}
                  name="tiempo_observaciones"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Motivo de la demora</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </Division>
            </div>

            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[1fr_2fr]">
              <FormField
                control={form.control}
                name="factura_remision"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Factura o remisión</FormLabel>
                    <FormControl>
                      <Input placeholder={fila.derivado.factura_remision ?? 'FC-00000'} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="observaciones"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones generales</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {fila.actualizado_por_nombre
                  ? `Última actualización: ${fila.actualizado_por_nombre}`
                  : 'Todavía nadie ha registrado el desempeño de esta orden.'}
              </p>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando...' : 'Guardar desempeño'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
