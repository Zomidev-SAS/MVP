'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Car,
  Loader2,
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
import { VehiculoProcesoDialog } from '@/components/dashboard/VehiculoProcesoDialog'

function iconoPorEtapa(etapa: string) {
  const t = etapa.toLowerCase()
  if (t === 'entrada') return ArrowDownToLine
  if (t === 'salida') return ArrowUpFromLine
  if (t === 'en proceso') return Wrench
  return ParkingSquare
}

function textoEtapaSinFormulario(etapa: EtapaVehiculoNombre): string {
  if (etapa === 'En proceso') return 'Sin registros de proceso'
  return 'Etapa completada'
}

function DetalleEventoFormulario({ evento }: { evento: EventoLineaTiempo }) {
  const fechaTexto =
    formatearFechaConHora(evento.fecha) ?? formatearFechaFormulario(evento.fecha) ?? 'Sin fecha'

  return (
    <div className="rounded border bg-muted/30 px-2 py-1.5 text-[10px] leading-snug">
      <p className="font-medium text-foreground">{evento.tipoLabel}</p>
      <p className="text-muted-foreground">{fechaTexto}</p>
      {evento.ciudad && <p className="text-muted-foreground">{evento.ciudad}</p>}
      {evento.marca && <p className="text-muted-foreground">{evento.marca}</p>}
    </div>
  )
}

function DetalleProceso({ proceso }: { proceso: VehiculoProceso }) {
  return (
    <div className="rounded border bg-muted/30 px-2 py-1.5 text-[10px] leading-snug">
      <p className="font-medium text-foreground">{proceso.titulo}</p>
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

export function VehiculoTimelineCard({ rolActual }: { rolActual: Role }) {
  const puedeAgregarProceso = ROLES_PROCESO_VEHICULO.includes(rolActual)
  const [termino, setTermino] = useState('')
  const [procesoDialogAbierto, setProcesoDialogAbierto] = useState(false)
  const [vehiculosRecientes, setVehiculosRecientes] = useState<VehiculoSugerencia[]>([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<VehiculoSugerencia | null>(
    null
  )
  const [etapas, setEtapas] = useState<EtapaVehiculo[]>([])
  const [procesos, setProcesos] = useState<VehiculoProceso[]>([])
  const [cargandoEventos, setCargandoEventos] = useState(false)

  useEffect(() => {
    setCargandoLista(true)
    fetchVehiculosRecientes(40)
      .then(setVehiculosRecientes)
      .catch((error) => {
        console.error('Failed to load recent vehiculos:', error)
        setVehiculosRecientes([])
      })
      .finally(() => setCargandoLista(false))
  }, [])

  const listaVisible = useMemo(() => {
    const q = termino.trim().toLowerCase()
    if (!q) return vehiculosRecientes
    return vehiculosRecientes.filter(
      (v) =>
        v.chasis.toLowerCase().includes(q) ||
        (v.marca?.toLowerCase().includes(q) ?? false) ||
        (v.ciudad?.toLowerCase().includes(q) ?? false)
    )
  }, [vehiculosRecientes, termino])

  const cargarDetalleVehiculo = useCallback(async (chasis: string) => {
    setCargandoEventos(true)
    try {
      const [eventos, listaProcesos] = await Promise.all([
        fetchLineaTiempoVehiculo(chasis),
        fetchProcesosVehiculo(chasis),
      ])
      setEtapas(construirEtapasVehiculo(eventos))
      setProcesos(listaProcesos)
    } catch (error) {
      console.error('Failed to load vehicle detail:', error)
      setEtapas([])
      setProcesos([])
    } finally {
      setCargandoEventos(false)
    }
  }, [])

  function seleccionarVehiculo(sugerencia: VehiculoSugerencia) {
    setVehiculoSeleccionado(sugerencia)
    setTermino(sugerencia.chasis)
    cargarDetalleVehiculo(sugerencia.chasis)
  }

  function limpiarSeleccion() {
    setVehiculoSeleccionado(null)
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
          <Car className="h-5 w-5 text-primary" />
          Estado vehículo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={termino}
            onChange={(e) => {
              setTermino(e.target.value)
              if (vehiculoSeleccionado && e.target.value !== vehiculoSeleccionado.chasis) {
                setVehiculoSeleccionado(null)
                setEtapas([])
                setProcesos([])
              }
            }}
            placeholder="Buscar por chasis, marca o ciudad..."
            className="pl-9"
          />
        </div>

        {!vehiculoSeleccionado && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Vehículos recientes {cargandoLista ? '' : `(${listaVisible.length})`}
            </p>
            <div className="max-h-48 overflow-y-auto rounded-md border border-border">
              {cargandoLista ? (
                <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando lista...
                </p>
              ) : listaVisible.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Sin vehículos registrados.</p>
              ) : (
                listaVisible.map((v) => (
                  <button
                    key={v.chasis}
                    type="button"
                    onClick={() => seleccionarVehiculo(v)}
                    className="flex w-full flex-col items-start border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                  >
                    <span className="font-mono font-medium">{v.chasis}</span>
                    <span className="text-xs text-muted-foreground">
                      {[v.marca, v.ciudad].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
                      {v.ultimo_ingreso
                        ? ` · ${formatearFechaFormulario(v.ultimo_ingreso) ?? v.ultimo_ingreso}`
                        : ''}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {vehiculoSeleccionado && (
          <div className="space-y-3">
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
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando historial...
              </div>
            ) : etapas.every((etapa) => !etapa.completada) && procesos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este vehículo no tiene formularios ni procesos registrados.
              </p>
            ) : (
              <div className="overflow-x-auto pb-1">
                <div className="grid min-w-[640px] grid-cols-4 gap-3">
                  {etapas.map((etapa) => {
                    const Icono = iconoPorEtapa(etapa.etapa)
                    const esProceso = etapa.etapa === 'En proceso'

                    return (
                      <div key={etapa.etapa} className="flex min-w-0 flex-col items-center">
                        <span
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-full border-2',
                            etapa.completada || esProceso
                              ? 'border-primary bg-primary/15 text-primary'
                              : 'border-dashed border-border bg-muted text-muted-foreground'
                          )}
                        >
                          <Icono className="h-4 w-4" />
                        </span>
                        <span
                          className={cn(
                            'mt-1 text-center text-[11px] font-medium',
                            etapa.completada || esProceso
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          )}
                        >
                          {etapa.etapa}
                        </span>

                        <div className="mt-2 w-full space-y-1.5">
                          {esProceso ? (
                            <>
                              {procesos.length === 0 ? (
                                <p className="text-center text-[10px] text-muted-foreground">
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
                                  className="mt-1 h-7 w-full text-[10px]"
                                  onClick={() => setProcesoDialogAbierto(true)}
                                >
                                  <Plus className="mr-1 h-3 w-3" />
                                  Agregar
                                </Button>
                              )}
                            </>
                          ) : etapa.evento ? (
                            <DetalleEventoFormulario evento={etapa.evento} />
                          ) : etapa.completada ? (
                            <p className="text-center text-[10px] text-muted-foreground">
                              {textoEtapaSinFormulario(etapa.etapa)}
                            </p>
                          ) : (
                            <p className="text-center text-[10px] text-muted-foreground">Pendiente</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {vehiculoSeleccionado && (
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
