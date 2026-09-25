'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
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
import { formatearFechaConHora } from '@/lib/formularios/fechas'
import { ROLES_PROCESO_VEHICULO } from '@/lib/permissions/roles'
import type { Role } from '@/lib/types/database'
import {
  guardarProcesoVehiculoSchema,
  type GuardarProcesoVehiculoInput,
  type VehiculoProceso,
} from '@/lib/types/vehiculo-proceso'
import { crearProcesoVehiculo, fetchProcesosVehiculo } from '@/lib/supabase/vehiculo-proceso-actions'

interface VehiculoProcesoDialogProps {
  abierto: boolean
  onOpenChange: (abierto: boolean) => void
  chasis: string
  rolActual: Role
}

function valoresIniciales(chasis: string): GuardarProcesoVehiculoInput {
  return { chasis, titulo: '', procesoEstado: '', observaciones: '', seccionSiguiente: '' }
}

export function VehiculoProcesoDialog({
  abierto,
  onOpenChange,
  chasis,
  rolActual,
}: VehiculoProcesoDialogProps) {
  const puedeAgregar = ROLES_PROCESO_VEHICULO.includes(rolActual)
  const [procesos, setProcesos] = useState<VehiculoProceso[]>([])
  const [cargando, setCargando] = useState(true)

  const form = useForm<GuardarProcesoVehiculoInput>({
    resolver: zodResolver(guardarProcesoVehiculoSchema),
    defaultValues: valoresIniciales(chasis),
  })

  useEffect(() => {
    if (!abierto) return

    const timeout = setTimeout(() => {
      setCargando(true)
      form.reset(valoresIniciales(chasis))
      fetchProcesosVehiculo(chasis)
        .then(setProcesos)
        .catch((error) => {
          console.error('Failed to load procesos vehiculo:', error)
          setProcesos([])
        })
        .finally(() => setCargando(false))
    }, 0)

    return () => clearTimeout(timeout)
    // form no cambia entre aperturas del mismo diálogo — evita relanzar el fetch por su identidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, chasis])

  async function onSubmit(datos: GuardarProcesoVehiculoInput) {
    const resultado = await crearProcesoVehiculo(datos)
    if (resultado.ok) {
      toast.success('Proceso agregado.')
      form.reset(valoresIniciales(chasis))
      const actualizados = await fetchProcesosVehiculo(chasis)
      setProcesos(actualizados)
    } else {
      toast.error(resultado.error)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Procesos — Chasis <span className="font-mono">{chasis}</span>
          </DialogTitle>
        </DialogHeader>

        {cargando ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando procesos...
          </div>
        ) : procesos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin procesos registrados todavía.</p>
        ) : (
          <ul className="space-y-3">
            {procesos.map((proceso) => (
              <li key={proceso.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{proceso.titulo}</p>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatearFechaConHora(proceso.creadoEn) ?? ''}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{proceso.procesoEstado}</p>
                {proceso.observaciones && <p className="mt-1 text-sm">{proceso.observaciones}</p>}
                {proceso.seccionSiguiente && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Siguiente: {proceso.seccionSiguiente}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {proceso.creadoPorNombre ?? 'Usuario desconocido'}
                </p>
              </li>
            ))}
          </ul>
        )}

        {puedeAgregar ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">Agregar proceso</p>
              <FormField
                control={form.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Cambio de motor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="procesoEstado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proceso/estado</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. En reparación" {...field} />
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
                      <Textarea placeholder="Detalles adicionales..." rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="seccionSiguiente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sección siguiente</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Instalación" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando...' : 'Guardar proceso'}
              </Button>
            </form>
          </Form>
        ) : (
          <p className="border-t pt-4 text-xs text-muted-foreground">
            Solo supervisor, metalmecánica e instalación pueden agregar procesos.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
