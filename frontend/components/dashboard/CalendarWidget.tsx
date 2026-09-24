'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EventoFormDialog } from '@/components/dashboard/EventoFormDialog'
import {
  eventoOcurreEnFecha,
  formatearRangoFechas,
  getFechasEvento,
  type CalendarEvento,
} from '@/lib/types/calendario'
import { fetchEventos } from '@/lib/supabase/calendario-actions'
import { NotesPanel } from '@/components/dashboard/NotesPanel'

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

function formatearFechaLegible(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
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
  const [dialogoDiaAbierto, setDialogoDiaAbierto] = useState(false)
  const [dialogoEventoAbierto, setDialogoEventoAbierto] = useState(false)
  const [eventoEditando, setEventoEditando] = useState<CalendarEvento | null>(null)

  const recargarEventos = useCallback(async () => {
    try {
      const actualizados = await fetchEventos()
      setEventos(actualizados)
    } catch (error) {
      console.error('Failed to fetch eventos:', error)
      toast.error('No se pudieron cargar los eventos.')
    }
  }, [])

  useEffect(() => {
    recargarEventos().finally(() => setLoading(false))
  }, [recargarEventos])

  const hoyKey = fechaKey(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const fechasConEvento = useMemo(() => {
    const set = new Set<string>()
    for (const evento of eventos) {
      if (evento.fecha_fin) {
        const inicio = new Date(evento.fecha + 'T00:00:00')
        const fin = new Date(evento.fecha_fin + 'T00:00:00')
        for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
          set.add(fechaKey(d.getFullYear(), d.getMonth(), d.getDate()))
        }
      } else {
        set.add(evento.fecha)
      }
      for (const extra of evento.fechas_adicionales) {
        set.add(extra)
      }
    }
    return set
  }, [eventos])

  const eventosDelDia = useMemo(
    () => eventos.filter((e) => eventoOcurreEnFecha(e, diaSeleccionado)),
    [eventos, diaSeleccionado]
  )

  const proximosEventos = useMemo(() => {
    return eventos
      .map((evento) => {
        const proxima = getFechasEvento(evento).find((f) => f >= hoyKey)
        return proxima ? { evento, proxima } : null
      })
      .filter((item): item is { evento: CalendarEvento; proxima: string } => item !== null)
      .sort((a, b) => a.proxima.localeCompare(b.proxima))
      .slice(0, 8)
  }, [eventos, hoyKey])

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

  function abrirEvento(evento: CalendarEvento) {
    setEventoEditando(evento)
    setDialogoDiaAbierto(false)
    setDialogoEventoAbierto(true)
  }

  function abrirNuevoEvento(fecha?: string) {
    setEventoEditando(null)
    if (fecha) setDiaSeleccionado(fecha)
    setDialogoDiaAbierto(false)
    setDialogoEventoAbierto(true)
  }

  function handleTapFecha(key: string) {
    setDiaSeleccionado(key)
    const delDia = eventos.filter((e) => eventoOcurreEnFecha(e, key))
    if (delDia.length === 1) {
      abrirEvento(delDia[0])
    } else {
      setDialogoDiaAbierto(true)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Calendario</CardTitle>
        <Button type="button" size="sm" onClick={() => abrirNuevoEvento(diaSeleccionado)}>
          <Plus className="mr-1 h-4 w-4" />
          Agregar evento
        </Button>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-3">
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
                  onClick={() => handleTapFecha(key)}
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
                    <span
                      className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
                        esSeleccionado ? 'bg-primary-foreground' : 'bg-primary'
                      }`}
                    />
                  )}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Toca una fecha para ver o editar sus eventos.
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium">Próximos eventos</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : proximosEventos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos próximos.</p>
          ) : (
            <ul className="space-y-2">
              {proximosEventos.map(({ evento, proxima }) => (
                <li key={evento.id}>
                  <button
                    type="button"
                    onClick={() => abrirEvento(evento)}
                    className="flex w-full items-start gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent/50"
                  >
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{evento.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatearRangoFechas(evento)}
                        {proxima !== evento.fecha && ` · próx: ${proxima}`}
                      </p>
                      {evento.nota && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {evento.nota}
                        </p>
                      )}
                      {evento.secciones.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {evento.secciones.filter((s) => s.completada).length}/
                          {evento.secciones.length} secciones
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <NotesPanel />
      </CardContent>

      <Dialog open={dialogoDiaAbierto} onOpenChange={setDialogoDiaAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eventos del {formatearFechaLegible(diaSeleccionado)}</DialogTitle>
          </DialogHeader>
          {eventosDelDia.length === 0 ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">No hay eventos en esta fecha.</p>
              <Button type="button" onClick={() => abrirNuevoEvento(diaSeleccionado)}>
                <Plus className="mr-1 h-4 w-4" />
                Crear evento
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <ul className="space-y-2">
                {eventosDelDia.map((evento) => (
                  <li key={evento.id}>
                    <button
                      type="button"
                      onClick={() => abrirEvento(evento)}
                      className="w-full rounded-md border p-3 text-left transition-colors hover:bg-accent/50"
                    >
                      <p className="font-medium">{evento.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatearRangoFechas(evento)}
                      </p>
                      {evento.nota && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {evento.nota}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <Button type="button" variant="outline" onClick={() => abrirNuevoEvento(diaSeleccionado)}>
                <Plus className="mr-1 h-4 w-4" />
                Agregar otro evento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EventoFormDialog
        abierto={dialogoEventoAbierto}
        onOpenChange={setDialogoEventoAbierto}
        evento={eventoEditando}
        fechaInicial={diaSeleccionado}
        onGuardado={recargarEventos}
      />
    </Card>
  )
}
