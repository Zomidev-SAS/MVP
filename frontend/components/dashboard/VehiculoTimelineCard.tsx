'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Car,
  Loader2,
  MapPin,
  ParkingSquare,
  Plus,
  Search,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatearFechaConHora } from '@/lib/formularios/fechas'
import { formatearFechaFormulario } from '@/lib/types/formularios'
import type { Role } from '@/lib/types/database'
import type { VehiculoProceso } from '@/lib/types/vehiculo-proceso'
import {
  buscarVehiculosFormulario,
  fetchLineaTiempoVehiculo,
  fetchVehiculosRecientes,
} from '@/lib/supabase/vehiculo-timeline-actions'
import { fetchProcesosVehiculo } from '@/lib/supabase/vehiculo-proceso-actions'
import { ROLES_PROCESO_VEHICULO } from '@/lib/permissions/roles'
import {
  construirEtapasVehiculo,
  type EtapaVehiculo,
  type EtapaVehiculoNombre,
  type EventoLineaTiempo,
  type VehiculoSugerencia,
} from '@/lib/formularios/linea-tiempo'
import {
  buscarVehiculosPlanta,
  fetchDetalleVehiculoPlanta,
  fetchVehiculosRecientesPlanta,
} from '@/lib/supabase/planta-actions'
import { VehiculoProcesoDialog } from '@/components/dashboard/VehiculoProcesoDialog'

function iconoPorEtapa(etapa: string) {
  const t = etapa.toLowerCase()
  if (t === 'entrada') return ArrowDownToLine
  if (t === 'salida') return ArrowUpFromLine
  if (t === 'en proceso') return Wrench
  return ParkingSquare
}

const ESTADO_BADGE: Record<EtapaVehiculoNombre, { label: string; className: string }> = {
  Entrada: {
    label: 'Entrada Completada',
    className: 'badge-success',
  },
  'En proceso': {
    label: 'En Transformación',
    className: 'badge-warning',
  },
  Parqueadero: {
    label: 'Parqueadero Técnico',
    className: 'badge-info',
  },
  Salida: {
    label: 'Salida Completada',
    className: 'badge-highlight',
  },
}

function EstadoVehiculoBadge({ estado }: { estado: EtapaVehiculoNombre | null | undefined }) {
  if (!estado) return null
  const badge = ESTADO_BADGE[estado]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
        badge.className
      )}
    >
      {badge.label}
    </span>
  )
}

function textoEtapaSinFormulario(etapa: EtapaVehiculoNombre): string {
  if (etapa === 'En proceso') return 'Sin registros de proceso'
  return 'Etapa completada'
}

function DetalleEventoFormulario({ evento }: { evento: EventoLineaTiempo }) {
  const fechaTexto =
    formatearFechaConHora(evento.fecha) ?? formatearFechaFormulario(evento.fecha) ?? 'Sin fecha'

  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm leading-snug">
      <p className="font-semibold text-foreground">{evento.tipoLabel}</p>
      <p className="text-muted-foreground">{fechaTexto}</p>
      {evento.ciudad && <p className="text-muted-foreground">{evento.ciudad}</p>}
      {evento.marca && <p className="text-muted-foreground">{evento.marca}</p>}
      {evento.ubicacion && (
        <p className="flex items-center gap-1 font-medium text-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {evento.ubicacion}
        </p>
      )}
    </div>
  )
}

function DetalleProceso({ proceso }: { proceso: VehiculoProceso }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm leading-snug">
      <p className="font-semibold text-foreground">{proceso.titulo}</p>
      <p className="text-muted-foreground">{proceso.procesoEstado}</p>
      {proceso.observaciones?.trim() && (
        <p className="mt-0.5 text-foreground">{proceso.observaciones}</p>
      )}
      {proceso.seccionSiguiente?.trim() && (
        <p className="text-muted-foreground">Siguiente: {proceso.seccionSiguiente}</p>
      )}
      <p className="mt-1 text-muted-foreground">
        {proceso.creadoPorNombre ?? 'Usuario desconocido'}
        {proceso.creadoEn ? ` · ${formatearFechaConHora(proceso.creadoEn) ?? proceso.creadoEn}` : ''}
      </p>
    </div>
  )
}

interface VehiculoTimelineCardProps {
  rolActual?: Role
  /** Modo pantalla de planta: solo lectura, datos vía token firmado y sin sesión. */
  tokenPlanta?: string
}

export function VehiculoTimelineCard({ rolActual, tokenPlanta }: VehiculoTimelineCardProps) {
  const soloLectura = tokenPlanta !== undefined
  const puedeAgregarProceso =
    !soloLectura && rolActual !== undefined && ROLES_PROCESO_VEHICULO.includes(rolActual)
  const [termino, setTermino] = useState('')
  const [procesoDialogAbierto, setProcesoDialogAbierto] = useState(false)
  const [vehiculosRecientes, setVehiculosRecientes] = useState<VehiculoSugerencia[]>([])
  const [resultadosBusqueda, setResultadosBusqueda] = useState<VehiculoSugerencia[]>([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [buscando, setBuscando] = useState(false)
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<VehiculoSugerencia | null>(
    null
  )
  const [etapas, setEtapas] = useState<EtapaVehiculo[]>([])
  const [eventos, setEventos] = useState<EventoLineaTiempo[]>([])
  const [procesos, setProcesos] = useState<VehiculoProceso[]>([])
  const [cargandoEventos, setCargandoEventos] = useState(false)

  useEffect(() => {
    setCargandoLista(true)
    const peticion = tokenPlanta
      ? fetchVehiculosRecientesPlanta(tokenPlanta, 40)
      : fetchVehiculosRecientes(40)
    peticion
      .then(setVehiculosRecientes)
      .catch((error) => {
        console.error('Failed to load recent vehiculos:', error)
        setVehiculosRecientes([])
      })
      .finally(() => setCargandoLista(false))
  }, [tokenPlanta])

  useEffect(() => {
    const q = termino.trim()
    if (!q) {
      setResultadosBusqueda([])
      setBuscando(false)
      return
    }
    setBuscando(true)
    const id = setTimeout(() => {
      const peticion = tokenPlanta
        ? buscarVehiculosPlanta(tokenPlanta, q)
        : buscarVehiculosFormulario(q)
      peticion
        .then(setResultadosBusqueda)
        .catch((error) => {
          console.error('Failed to search vehiculos:', error)
          setResultadosBusqueda([])
        })
        .finally(() => setBuscando(false))
    }, 300)
    return () => clearTimeout(id)
  }, [termino, tokenPlanta])

  const buscandoActivamente = termino.trim().length > 0
  const listaVisible = buscandoActivamente ? resultadosBusqueda : vehiculosRecientes

  const cargarDetalleVehiculo = useCallback(async (chasis: string) => {
    setCargandoEventos(true)
    try {
      const { eventos: listaEventos, procesos: listaProcesos } = tokenPlanta
        ? await fetchDetalleVehiculoPlanta(tokenPlanta, chasis)
        : {
            eventos: await fetchLineaTiempoVehiculo(chasis),
            procesos: await fetchProcesosVehiculo(chasis),
          }
      setEventos(listaEventos)
      setEtapas(construirEtapasVehiculo(listaEventos))
      setProcesos(listaProcesos)
    } catch (error) {
      console.error('Failed to load vehicle detail:', error)
      setEventos([])
      setEtapas([])
      setProcesos([])
    } finally {
      setCargandoEventos(false)
    }
  }, [tokenPlanta])

  function seleccionarVehiculo(sugerencia: VehiculoSugerencia) {
    setVehiculoSeleccionado(sugerencia)
    setTermino(sugerencia.chasis)
    cargarDetalleVehiculo(sugerencia.chasis)
  }

  function limpiarSeleccion() {
    setVehiculoSeleccionado(null)
    setEventos([])
    setEtapas([])
    setProcesos([])
    setTermino('')
  }

  function handleProcesoAgregado() {
    if (vehiculoSeleccionado) {
      cargarDetalleVehiculo(vehiculoSeleccionado.chasis)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car aria-hidden="true" className="h-5 w-5 text-primary" />
          Estado vehículo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Buscar vehículo por chasis, marca o ciudad"
            value={termino}
            onChange={(e) => {
              setTermino(e.target.value)
              if (vehiculoSeleccionado && e.target.value !== vehiculoSeleccionado.chasis) {
                setVehiculoSeleccionado(null)
                setEventos([])
                setEtapas([])
                setProcesos([])
              }
            }}
            placeholder="Buscar por chasis, marca o ciudad..."
            className="pl-9"
          />
        </div>

        {!vehiculoSeleccionado && (
          <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-150 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {buscandoActivamente
                ? `Resultados ${buscando ? '' : `(${listaVisible.length})`}`
                : `Vehículos recientes ${cargandoLista ? '' : `(${listaVisible.length})`}`}
            </p>
            <div className="max-h-80 overflow-y-auto rounded-md border border-border">
              {cargandoLista || buscando ? (
                <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  {buscandoActivamente ? 'Buscando...' : 'Cargando lista...'}
                </p>
              ) : listaVisible.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  {buscandoActivamente
                    ? 'Sin vehículos que coincidan con la búsqueda.'
                    : 'Sin vehículos registrados.'}
                </p>
              ) : (
                listaVisible.map((v) => (
                  <button
                    key={v.chasis}
                    type="button"
                    onClick={() => seleccionarVehiculo(v)}
                    className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                  >
                    <span className="flex min-w-0 flex-col items-start">
                      <span className="font-mono font-medium">{v.chasis}</span>
                      <span className="text-xs text-muted-foreground">
                        {[v.marca, v.ciudad].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
                        {v.ultimo_ingreso
                          ? ` · ${formatearFechaFormulario(v.ultimo_ingreso) ?? v.ultimo_ingreso}`
                          : ''}
                      </span>
                      {v.ubicacion && (
                        <span className="flex items-center gap-1 text-xs font-medium text-foreground">
                          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {v.ubicacion}
                        </span>
                      )}
                    </span>
                    <EstadoVehiculoBadge estado={v.estadoActual} />
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {vehiculoSeleccionado && (
          <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-150 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                Chasis <span className="font-mono font-medium">{vehiculoSeleccionado.chasis}</span>
              </p>
              <button
                type="button"
                onClick={limpiarSeleccion}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Ver lista
              </button>
            </div>

            {cargandoEventos ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Cargando historial...
              </div>
            ) : etapas.every((etapa) => !etapa.completada) && procesos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este vehículo no tiene formularios ni procesos registrados.
              </p>
            ) : (
              <div className="overflow-x-auto pb-1">
                <div className="relative grid min-w-[880px] grid-cols-4 gap-5">
                  <div aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-7 h-0.5 bg-border" />
                  {etapas.map((etapa) => {
                    const Icono = iconoPorEtapa(etapa.etapa)
                    const esProceso = etapa.etapa === 'En proceso'

                    return (
                      <div key={etapa.etapa} className="flex min-w-0 flex-col items-center">
                        <span
                          className={cn(
                            'relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-2 bg-background',
                            etapa.completada || esProceso
                              ? 'border-primary bg-primary/15 text-primary'
                              : 'border-dashed border-border bg-muted text-muted-foreground'
                          )}
                        >
                          <Icono aria-hidden="true" className="h-6 w-6" />
                        </span>
                        <span
                          className={cn(
                            'mt-2 text-center text-base font-semibold',
                            etapa.completada || esProceso
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          )}
                        >
                          {etapa.etapa}
                        </span>

                        <div className="mt-3 w-full space-y-2">
                          {esProceso ? (
                            <>
                              {procesos.length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground">
                                  {textoEtapaSinFormulario(etapa.etapa)}
                                </p>
                              ) : (
                                procesos.map((proceso) => (
                                  <DetalleProceso key={proceso.id} proceso={proceso} />
                                ))
                              )}
                              {puedeAgregarProceso && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="mt-1 h-9 w-full text-sm"
                                  onClick={() => setProcesoDialogAbierto(true)}
                                >
                                  <Plus aria-hidden="true" className="mr-1 h-3 w-3" />
                                  Agregar
                                </Button>
                              )}
                            </>
                          ) : etapa.evento ? (
                            <DetalleEventoFormulario evento={etapa.evento} />
                          ) : etapa.completada ? (
                            <p className="text-center text-sm text-muted-foreground">
                              {textoEtapaSinFormulario(etapa.etapa)}
                            </p>
                          ) : (
                            <p className="text-center text-sm text-muted-foreground">Pendiente</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {!cargandoEventos && (eventos.length > 0 || procesos.length > 0) && (
              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-semibold">Cronología completa</p>
                <ol className="space-y-2 border-l-2 border-border pl-4">
                  {[
                    ...eventos.map((e) => ({
                      key: `f-${e.id}`,
                      fecha: e.fecha,
                      nodo: <DetalleEventoFormulario evento={e} />,
                    })),
                    ...procesos.map((p) => ({
                      key: `p-${p.id}`,
                      fecha: p.creadoEn,
                      nodo: <DetalleProceso proceso={p} />,
                    })),
                  ]
                    .sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
                    .map((item) => (
                      <li key={item.key} className="relative">
                        <span
                          aria-hidden="true"
                          className="absolute -left-[22px] top-3 h-2.5 w-2.5 rounded-full bg-primary"
                        />
                        {item.nodo}
                      </li>
                    ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {vehiculoSeleccionado && !soloLectura && rolActual && (
        <VehiculoProcesoDialog
          abierto={procesoDialogAbierto}
          onOpenChange={setProcesoDialogAbierto}
          chasis={vehiculoSeleccionado.chasis}
          rolActual={rolActual}
          onProcesoAgregado={handleProcesoAgregado}
        />
      )}
    </Card>
  )
}
