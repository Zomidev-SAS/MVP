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
import { actualizarProveedor, crearProveedor } from '@/lib/supabase/proveedores-actions'
import {
  guardarProveedorSchema,
  type GuardarProveedorInput,
  type Proveedor,
} from '@/lib/types/proveedor'

interface ProveedorFormDialogProps {
  abierto: boolean
  onOpenChange: (abierto: boolean) => void
  /** Proveedor a editar; null para crear uno nuevo. */
  proveedor: Proveedor | null
  onGuardado: () => void
}

function valoresIniciales(proveedor: Proveedor | null): GuardarProveedorInput {
  return {
    nit: proveedor?.nit ?? '',
    nombre: proveedor?.nombre ?? '',
    email: proveedor?.email ?? '',
    telefono: proveedor?.telefono ?? '',
    contacto: proveedor?.contacto ?? '',
    notas: proveedor?.notas ?? '',
  }
}

export function ProveedorFormDialog({
  abierto,
  onOpenChange,
  proveedor,
  onGuardado,
}: ProveedorFormDialogProps) {
  const esEdicion = proveedor !== null

  const form = useForm<GuardarProveedorInput>({
    resolver: zodResolver(guardarProveedorSchema),
    defaultValues: valoresIniciales(proveedor),
  })

  useEffect(() => {
    if (abierto) form.reset(valoresIniciales(proveedor))
  }, [abierto, proveedor, form])

  async function onSubmit(datos: GuardarProveedorInput) {
    const resultado = esEdicion
      ? await actualizarProveedor(proveedor.id, datos)
      : await crearProveedor(datos)

    if (resultado.ok) {
      toast.success(esEdicion ? 'Proveedor actualizado.' : 'Proveedor creado.')
      onOpenChange(false)
      onGuardado()
    } else {
      toast.error(resultado.error)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{esEdicion ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr]">
              <FormField
                control={form.control}
                name="nit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NIT</FormLabel>
                    <FormControl>
                      <Input placeholder="890.903.938-8" inputMode="numeric" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Razón social del proveedor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="ventas@proveedor.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input type="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="contacto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Persona de contacto</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? 'Guardando...'
                : esEdicion
                  ? 'Guardar cambios'
                  : 'Crear proveedor'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
