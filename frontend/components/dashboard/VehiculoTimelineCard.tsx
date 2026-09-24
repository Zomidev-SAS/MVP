'use client'

import { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Car,
  Loader2,
  ParkingSquare,
  Search,
  Wrench,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatearFechaFormulario } from '@/lib/types/formularios'
import {
  buscarVehiculosFormulario,
  fetchLineaTiempoVehiculo,
} from '@/lib/supabase/vehiculo-timeline-actions'
import {
  construirEtapasVehiculo,
  type EtapaVehiculo,
  type EtapaVehiculoNombre,
  type VehiculoSugerencia,
} from '@/lib/formularios/linea-tiempo'

function iconoPorEtapa(etapa: string) {
  const t = etapa.toLowerCase()
  if (t === 'entrada') return ArrowDownToLine
  if (t === 'salida') return ArrowUpFromLine
  if (t === 'en proceso') return Wrench
  return ParkingSquare
}

function ultimaEtapaCompletada(etapas: EtapaVehiculo[]): number {
  return etapas.reduce((acc, etapa, indice) => (etapa.completada ? indice : acc), 0)
}

function textoEtapaSinFormulario(etapa: EtapaVehiculoNombre): string {
  if (etapa === 'En proceso') return 'Vehículo en gestión activa'
  return 'Sin formulario propio — el vehículo ya avanzó'
}

export function VehiculoTimelineCard() {
  const [termino, setTermino] = useState('')
  const [sugerencias, setSugerencias] = useState<VehiculoSugerencia[]>([])
  const [buscando, setBuscando] = useState(false)
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<VehiculoSugerencia | null>(
    null
  )
  const [etapas, setEtapas] = useState<EtapaVehiculo[]>([])
  const [cargandoEventos, setCargandoEventos] = useState(false)
  const [pasoActivo, setPasoActivo] = useState(0)

  useEffect(() => {
    if (vehiculoSeleccionado) return
    const q = termino.trim()
    if (q.length < 2) return

    const timeout = setTimeout(() => {
      setBuscando(true)
      buscarVehiculosFormulario(q)
        .then(setSugerencias)
        .catch((error) => {
          console.error('Failed to search vehiculos:', error)
          setSugerencias([])
        })
        .finally(() => setBuscando(false))
    }, 400)

    return () => clearTimeout(timeout)
  }, [termino, vehiculoSeleccionado])

  function seleccionarVehiculo(sugerencia: VehiculoSugerencia) {
    setVehiculoSeleccionado(sugerencia)
    setTermino(sugerencia.chasis)
    setSugerencias([])
    setCargandoEventos(true)
    fetchLineaTiempoVehiculo(sugerencia.chasis)
      .then((data) => {
        const etapasCalculadas = construirEtapasVehiculo(data)
        setEtapas(etapasCalculadas)
        setPasoActivo(ultimaEtapaCompletada(etapasCalculadas))
      })
      .catch((error) => {
        console.error('Failed to load vehicle timeline:', error)
        setEtapas([])
      })
      .finally(() => setCargandoEventos(false))
  }

  function limpiarSeleccion() {
    setVehiculoSeleccionado(null)
    setEtapas([])
    setTermino('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="h-5 w-5 text-primary" />
          Línea de tiempo del vehículo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={termino}
            onChange={(e) => {
              setTermino(e.target.value)
              if (vehiculoSeleccionado) setVehiculoSeleccionado(null)
            }}
            placeholder="Buscar por chasis o placa..."
            className="pl-9"
          />

          {!vehiculoSeleccionado && termino.trim().length >= 2 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
              {buscando ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
              ) : sugerencias.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias.</p>
              ) : (
                sugerencias.map((s) => (
                  <button
                    key={s.chasis}
                    type="button"
                    onClick={() => seleccionarVehiculo(s)}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="font-mono font-medium">{s.chasis}</span>
                    <span className="text-xs text-muted-foreground">
                      {[s.marca, s.ciudad].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {!vehiculoSeleccionado && (
          <p className="text-sm text-muted-foreground">
            Busca un vehículo por chasis o placa para ver su historial.
          </p>
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
                Buscar otro
              </button>
            </div>

            {cargandoEventos ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando historial...
              </div>
            ) : etapas.every((etapa) => !etapa.completada) ? (
              <p className="text-sm text-muted-foreground">
                Este vehículo no tiene formularios registrados.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex w-full items-start">
                  {etapas.map((etapa, indice) => {
                    const Icono = iconoPorEtapa(etapa.etapa)
                    const esActivo = indice === pasoActivo
                    const esUltimo = indice === etapas.length - 1

                    return (
                      <div
                        key={etapa.etapa}
                        className={cn('flex items-center', !esUltimo && 'flex-1')}
                      >
                        <div
                          role="img"
                          aria-label={`${etapa.etapa}, paso ${indice + 1} de ${etapas.length}${etapa.completada ? '' : ' (pendiente)'}`}
                          className="flex shrink-0 flex-col items-center gap-1.5"
                        >
                          <span
                            className={cn(
                              'flex items-center justify-center rounded-full border-2 transition-colors',
                              esActivo
                                ? 'h-10 w-10 border-primary bg-primary text-primary-foreground'
                                : etapa.completada
                                  ? 'h-8 w-8 border-primary bg-primary/15 text-primary'
                                  : 'h-8 w-8 border-dashed border-border bg-muted text-muted-foreground'
                            )}
                          >
                            <Icono className={esActivo ? 'h-5 w-5' : 'h-4 w-4'} />
                          </span>
                          <span
                            className={cn(
                              'whitespace-nowrap text-[11px]',
                              esActivo ? 'font-medium text-foreground' : 'text-muted-foreground'
                            )}
                          >
                            {etapa.etapa}
                          </span>
                        </div>
                        {!esUltimo && (
                          <div
                            className={cn(
                              'mx-1.5 h-0.5 flex-1 sm:mx-2',
                              etapas[indice + 1].completada ? 'bg-primary' : 'bg-border'
                            )}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>

                {etapas[pasoActivo] && (
                  <div className="text-center">
                    <p className="text-sm font-medium">{etapas[pasoActivo].etapa}</p>
                    {etapas[pasoActivo].evento ? (
                      <p className="text-xs text-muted-foreground">
                        {formatearFechaFormulario(etapas[pasoActivo].evento!.fecha) || 'Sin fecha'}
                        {etapas[pasoActivo].evento!.ciudad
                          ? ` · ${etapas[pasoActivo].evento!.ciudad}`
                          : ''}
                      </p>
                    ) : etapas[pasoActivo].completada ? (
                      <p className="text-xs text-muted-foreground">
                        {textoEtapaSinFormulario(etapas[pasoActivo].etapa)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Pendiente</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Paso {pasoActivo + 1} de {etapas.length}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
