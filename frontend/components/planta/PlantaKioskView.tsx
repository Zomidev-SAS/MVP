'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { VehiculosPorEtapaChart } from '@/components/dashboard/charts/VehiculosPorEtapaChart'
import { EntradasSalidasChart } from '@/components/dashboard/EntradasSalidasChart'
import { LowStockList, type ProductoBajoStock } from '@/components/dashboard/LowStockList'
import { cn } from '@/lib/utils'
import type { VehiculoPorEtapaPunto } from '@/lib/types/dashboard-graficas'
import type { EntradaSalidaDia } from '@/lib/types/dashboard'

interface PlantaKioskViewProps {
  vehiculosPorEtapa: VehiculoPorEtapaPunto[]
  entradasSalidas: EntradaSalidaDia[]
  productosStockBajo: ProductoBajoStock[]
}

const ROTACION_MS = 30_000
const VISTAS = [
  { id: 'resumen', titulo: 'Resumen' },
  { id: 'etapas', titulo: 'Vehículos por etapa' },
  { id: 'entradas-salidas', titulo: 'Entradas vs. salidas' },
  { id: 'stock-bajo', titulo: 'Stock bajo' },
] as const

function Kpi({ label, valor, detalle }: { label: string; valor: string | number; detalle?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
      <p className="text-xl text-muted-foreground">{label}</p>
      <p className="mt-2 text-6xl font-bold tabular-nums">{valor}</p>
      {detalle && <p className="mt-2 text-lg text-muted-foreground">{detalle}</p>}
    </div>
  )
}

export function PlantaKioskView({
  vehiculosPorEtapa,
  entradasSalidas,
  productosStockBajo,
}: PlantaKioskViewProps) {
  const router = useRouter()
  const [indice, setIndice] = useState(0)
  const [automatico, setAutomatico] = useState(true)
  // Esta pantalla corre SIN sesión (cliente anon de Supabase): las políticas
  // RLS de `postgres_changes` casi seguro escopan la entrega de eventos
  // realtime a roles autenticados, así que un canal realtime aquí reportaría
  // "conectado" pero nunca recibiría INSERT/UPDATE — y el fallback de polling
  // de useRealtimeChannel solo se activa si el canal se desconecta, no si
  // simplemente nunca recibe nada. Por eso esta vista usa polling simple e
  // incondicional en vez de useRealtimeChannel (que es la herramienta
  // correcta para sesiones autenticadas, no para este kiosko anónimo).
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000)
    return () => clearInterval(id)
  }, [router])

  const ir = useCallback((delta: number) => {
    setIndice((i) => (i + delta + VISTAS.length) % VISTAS.length)
  }, [])

  // Reinicia el temporizador tras cada cambio (manual o automático).
  useEffect(() => {
    if (!automatico) return
    const id = setTimeout(() => ir(1), ROTACION_MS)
    return () => clearTimeout(id)
  }, [automatico, indice, ir])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') ir(1)
      else if (e.key === 'ArrowLeft') ir(-1)
      else if (e.key === ' ') {
        e.preventDefault()
        setAutomatico((a) => !a)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ir])

  const vista = VISTAS[indice]

  const totalVehiculos = vehiculosPorEtapa.reduce((s, v) => s + v.cantidad, 0)
  const totalEntradas = entradasSalidas.reduce((s, d) => s + d.entradas, 0)
  const totalSalidas = entradasSalidas.reduce((s, d) => s + d.salidas, 0)
  const etapaMayor = vehiculosPorEtapa.reduce<VehiculoPorEtapaPunto | null>(
    (m, v) => (!m || v.cantidad > m.cantidad ? v : m),
    null
  )

  const botonNav =
    'flex h-16 w-16 shrink-0 items-center justify-center rounded-full border bg-card text-foreground shadow-sm transition-colors hover:bg-accent'

  return (
    <div className="flex h-screen w-screen flex-col bg-background p-8 text-foreground">
      <header className="flex items-center justify-between">
        <h1 className="text-5xl font-bold">{vista.titulo}</h1>
        <p className="text-xl text-muted-foreground">
          {indice + 1} / {VISTAS.length}
        </p>
      </header>

      <main className="flex min-h-0 flex-1 items-center gap-6 py-6">
        <button type="button" aria-label="Vista anterior" onClick={() => ir(-1)} className={botonNav}>
          <ChevronLeft aria-hidden="true" className="h-9 w-9" />
        </button>

        <div className="h-full min-w-0 flex-1 overflow-y-auto">
          {vista.id === 'resumen' && (
            <div className="grid h-full grid-cols-1 content-center gap-6 lg:grid-cols-2">
              <div className="grid grid-cols-2 gap-6">
                <Kpi label="Vehículos en planta" valor={totalVehiculos} />
                <Kpi
                  label="Etapa con más vehículos"
                  valor={etapaMayor?.cantidad ?? 0}
                  detalle={etapaMayor?.etapa ?? 'Sin datos'}
                />
                <Kpi label="Entradas (7 días)" valor={totalEntradas} />
                <Kpi label="Salidas (7 días)" valor={totalSalidas} />
                <div className="col-span-2">
                  <Kpi
                    label="Productos con stock bajo"
                    valor={productosStockBajo.length}
                    detalle={
                      productosStockBajo.length > 0
                        ? productosStockBajo
                            .slice(0, 3)
                            .map((p) => p.nombre_producto ?? p.codigo_producto)
                            .join(' · ')
                        : 'Todo en orden'
                    }
                  />
                </div>
              </div>
              <div className="space-y-6">
                <div className="rounded-2xl border bg-card p-4 text-lg">
                  <VehiculosPorEtapaChart data={vehiculosPorEtapa} />
                </div>
                <div className="rounded-2xl border bg-card p-4">
                  <EntradasSalidasChart data={entradasSalidas} />
                </div>
              </div>
            </div>
          )}
          {vista.id === 'etapas' && (
            <div className="mx-auto w-full max-w-6xl text-2xl">
              <VehiculosPorEtapaChart data={vehiculosPorEtapa} />
            </div>
          )}
          {vista.id === 'entradas-salidas' && (
            <div className="mx-auto w-full max-w-6xl">
              <EntradasSalidasChart data={entradasSalidas} />
            </div>
          )}
          {vista.id === 'stock-bajo' && (
            <div className="mx-auto w-full max-w-4xl text-2xl">
              <LowStockList productos={productosStockBajo} />
            </div>
          )}
        </div>

        <button type="button" aria-label="Vista siguiente" onClick={() => ir(1)} className={botonNav}>
          <ChevronRight aria-hidden="true" className="h-9 w-9" />
        </button>
      </main>

      <footer className="flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label={automatico ? 'Pausar rotación' : 'Reanudar rotación'}
          onClick={() => setAutomatico((a) => !a)}
          className="flex h-10 w-10 items-center justify-center rounded-full border bg-card hover:bg-accent"
        >
          {automatico ? (
            <Pause aria-hidden="true" className="h-5 w-5" />
          ) : (
            <Play aria-hidden="true" className="h-5 w-5" />
          )}
        </button>
        {VISTAS.map((v, i) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setIndice(i)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-base transition-colors',
              i === indice
                ? 'bg-foreground text-background'
                : 'bg-card text-muted-foreground hover:bg-accent'
            )}
          >
            {v.titulo}
          </button>
        ))}
      </footer>
    </div>
  )
}
