'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { entradaSchema, type EntradaInput } from '@/lib/types/entradas'
import { crearEntrada } from '@/lib/supabase/entradas-actions'

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs'

const BODEGAS_REALES = [
  'Sin Asignar',
  'ALMACEN NIVEL 1',
  'ALMACEN NIVEL 2',
  'ALMACEN NIVEL 3',
  'METALMECANICA',
  'PRODUCTO TERMINADO',
  'MADERAS',
  'DESCANSABRAZOS',
  'AUDIO Y VIDEO',
]

const VALORES_INICIALES: EntradaInput = {
  codigo_producto: '',
  bodega: '',
  cantidad: 0,
  valor_unitario: undefined,
  motivo: '',
}

export function EntryForm() {
  const form = useForm({
    resolver: zodResolver(entradaSchema),
    defaultValues: VALORES_INICIALES,
  })

  async function onSubmit(datos: EntradaInput) {
    const resultado = await crearEntrada(datos)
    if (resultado.ok) {
      toast.success('Entrada registrada correctamente.')
      form.reset(VALORES_INICIALES)
    } else {
      toast.error(resultado.error)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
        <FormField
          control={form.control}
          name="codigo_producto"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Código de producto</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bodega"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bodega</FormLabel>
              <FormControl>
                <select {...field} className={SELECT_CLASS}>
                  <option value="">Selecciona una bodega</option>
                  {BODEGAS_REALES.map((bodega) => (
                    <option key={bodega} value={bodega}>
                      {bodega}
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
          name="cantidad"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cantidad</FormLabel>
              <FormControl>
                <Input type="number" {...field} value={field.value as number | undefined} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="valor_unitario"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor Unitario</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  value={(field.value as number | undefined) ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="motivo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Motivo / Notas</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Entrada'}
        </Button>
      </form>
    </Form>
  )
}
