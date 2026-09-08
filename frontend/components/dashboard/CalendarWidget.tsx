'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { crearEventoSchema, type CrearEventoInput, type CalendarEvento } from '@/lib/types/calendario'
import { fetchEventos, crearEvento, eliminarEvento } from '@/lib/supabase/calendario-actions'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function fechaKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function getMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingBlanks = (firstDay.getDay() + 6) % 7
  const cells: (number | null)[] = Array(leadingBlanks).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

export function CalendarWidget() {
  const hoy = new Date()
  const [viewYear, setViewYear] = useState(hoy.getFullYear())
  const [viewMonth, setViewMonth] = useState(hoy.getMonth())
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>(
    fechaKey(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  )
  const [eventos, setEventos] = useState<CalendarEvento[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogoAbierto, setDialogoAbierto] = useState(false)

  const form = useForm<CrearEventoInput>({
    resolver: zodResolver(crearEventoSchema),
    defaultValues: { fecha: diaSeleccionado, titulo: '', nota: '' },
  })

  useEffect(() => {
    fetchEventos()
      .then(setEventos)
      .catch((error) => {
        console.error('Failed to fetch eventos:', error)
        setEventos([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (dialogoAbierto) {
      form.reset({ fecha: diaSeleccionado, titulo: '', nota: '' })
    }
  }, [dialogoAbierto, diaSeleccionado, form])

  const hoyKey = fechaKey(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])
  const fechasConEvento = useMemo(() => new Set(eventos.map((e) => e.fecha)), [eventos])
  const proximosEventos = useMemo(
    () => eventos.filter((e) => e.fecha >= hoyKey).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [eventos, hoyKey]
  )

  function irMesAnterior() {
    const nuevo = new Date(viewYear, viewMonth - 1, 1)
    setViewYear(nuevo.getFullYear())
    setViewMonth(nuevo.getMonth())
  }

  function irMesSiguiente() {
    const nuevo = new Date(viewYear, viewMonth + 1, 1)
    setViewYear(nuevo.getFullYear())
    setViewMonth(nuevo.getMonth())
  }

  async function onSubmit(datos: CrearEventoInput) {
    const resultado = await crearEvento(datos)
    if (resultado.ok) {
      toast.success('Evento agregado.')
      setDialogoAbierto(false)
      const actualizados = await fetchEventos()
      setEventos(actualizados)
    } else {
      toast.error(resultado.error)
    }
  }

  async function handleBorrar(id: number) {
    const resultado = await eliminarEvento(id)
    if (resultado.ok) {
      toast.success('Evento borrado.')
      setEventos((prev) => prev.filter((e) => e.id !== id))
    } else {
      toast.error(resultado.error)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Calendario</CardTitle>
        <Button type="button" size="sm" onClick={() => setDialogoAbierto(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Agregar evento
        </Button>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" onClick={irMesAnterior}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {MESES[viewMonth]} {viewYear}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={irMesSiguiente}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {DIAS_SEMANA.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((dia, i) => {
              if (dia === null) return <div key={`blank-${i}`} />
              const key = fechaKey(viewYear, viewMonth, dia)
              const tieneEvento = fechasConEvento.has(key)
              const esSeleccionado = key === diaSeleccionado
              const esHoy = key === hoyKey
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDiaSeleccionado(key)}
                  className={`relative flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors ${
                    esSeleccionado
                      ? 'bg-primary text-primary-foreground'
                      : esHoy
                        ? 'bg-accent'
                        : 'hover:bg-accent'
                  }`}
                >
                  {dia}
                  {tieneEvento && (
                    <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">Próximos eventos</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : proximosEventos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos próximos.</p>
          ) : (
            <ul className="space-y-2">
              {proximosEventos.map((evento) => (
                <li
                  key={evento.id}
                  className="flex items-start justify-between gap-2 rounded-md border p-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{evento.titulo}</p>
                    <p className="text-xs text-muted-foreground">{evento.fecha}</p>
                    {evento.nota && (
                      <p className="text-xs text-muted-foreground">{evento.nota}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBorrar(evento.id)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Borrar evento"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>

      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar evento</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fecha"
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
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                    <FormLabel>Nota (opcional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando...' : 'Guardar'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
