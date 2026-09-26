'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { ROLES_PROCESO_VEHICULO } from '@/lib/permissions/roles'
import type { Role } from '@/lib/types/database'
import {
  guardarProcesoVehiculoSchema,
  type GuardarProcesoVehiculoInput,
} from '@/lib/types/vehiculo-proceso'
import { crearProcesoVehiculo } from '@/lib/supabase/vehiculo-proceso-actions'

interface VehiculoProcesoDialogProps {
  abierto: boolean
  onOpenChange: (abierto: boolean) => void
  chasis: string
  rolActual: Role
  onProcesoAgregado?: () => void
}

function valoresIniciales(chasis: string): GuardarProcesoVehiculoInput {
  return { chasis, titulo: '', procesoEstado: '', observaciones: '', seccionSiguiente: '' }
}

export function VehiculoProcesoDialog({
  abierto,
  onOpenChange,
  chasis,
  rolActual,
  onProcesoAgregado,
}: VehiculoProcesoDialogProps) {
  const puedeAgregar = ROLES_PROCESO_VEHICULO.includes(rolActual)

  const form = useForm<GuardarProcesoVehiculoInput>({
    resolver: zodResolver(guardarProcesoVehiculoSchema),
    defaultValues: valoresIniciales(chasis),
  })

  useEffect(() => {
    if (!abierto) return
    form.reset(valoresIniciales(chasis))
  }, [abierto, chasis, form])

  async function onSubmit(datos: GuardarProcesoVehiculoInput) {
    const resultado = await crearProcesoVehiculo(datos)
    if (resultado.ok) {
      toast.success('Proceso agregado.')
      form.reset(valoresIniciales(chasis))
      onOpenChange(false)
      onProcesoAgregado?.()
    } else {
      toast.error(resultado.error)
    }
  }

  if (!puedeAgregar) return null

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Agregar proceso — Chasis <span className="font-mono">{chasis}</span>
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          El registro aparecerá debajo de la etapa &quot;En proceso&quot; con autor, fecha y hora.
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
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
            <div className="flex gap-2">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando...' : 'Guardar proceso'}
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
