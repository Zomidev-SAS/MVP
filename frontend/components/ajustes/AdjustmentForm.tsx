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
import { solicitarAjusteSchema, type SolicitarAjusteInput } from '@/lib/types/ajustes'
import { solicitarAjuste } from '@/lib/supabase/ajustes-actions'

const VALORES_INICIALES: SolicitarAjusteInput = {
  vin: '',
  cantidad: 0,
  motivo: '',
  evidencia: '',
}

export function AdjustmentForm() {
  const form = useForm({
    resolver: zodResolver(solicitarAjusteSchema),
    defaultValues: VALORES_INICIALES,
  })

  async function onSubmit(datos: SolicitarAjusteInput) {
    const resultado = await solicitarAjuste(datos)
    if (resultado.ok) {
      toast.success('Solicitud de ajuste enviada.')
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
          name="vin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>VIN</FormLabel>
              <FormControl>
                <Input {...field} />
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
              <FormLabel>Cantidad Ajuste</FormLabel>
              <FormControl>
                <Input type="number" {...field} value={field.value as number} />
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
              <FormLabel>Motivo</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="evidencia"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Evidencia</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Descripción de la evidencia" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Enviando...' : 'Solicitar Ajuste'}
        </Button>
      </form>
    </Form>
  )
}
