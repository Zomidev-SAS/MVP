'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { VehiculosPorEtapaChart } from '@/components/dashboard/charts/VehiculosPorEtapaChart'
import { EntradasSalidasChart } from '@/components/dashboard/EntradasSalidasChart'
import { LowStockList, type ProductoBajoStock } from '@/components/dashboard/LowStockList'
import type { VehiculoPorEtapaPunto } from '@/lib/types/dashboard-graficas'
import type { EntradaSalidaDia } from '@/lib/types/dashboard'

interface PlantaKioskViewProps {
  vehiculosPorEtapa: VehiculoPorEtapaPunto[]
  entradasSalidas: EntradaSalidaDia[]
  productosStockBajo: ProductoBajoStock[]
}

const ROTACION_MS = 30_000
const VISTAS = ['etapas', 'entradas-salidas', 'stock-bajo'] as const

export function PlantaKioskView({
  vehiculosPorEtapa,
  entradasSalidas,
  productosStockBajo,
}: PlantaKioskViewProps) {
  const router = useRouter()
  const [indice, setIndice] = useState(0)
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

  useEffect(() => {
    const id = setInterval(() => setIndice((i) => (i + 1) % VISTAS.length), ROTACION_MS)
    return () => clearInterval(id)
  }, [])

  const vista = VISTAS[indice]

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-12 text-foreground">
      {vista === 'etapas' && (
        <>
          <h1 className="mb-8 text-5xl font-bold">Vehículos por etapa</h1>
          <div className="w-full max-w-5xl text-2xl">
            <VehiculosPorEtapaChart data={vehiculosPorEtapa} />
          </div>
        </>
      )}
      {vista === 'entradas-salidas' && (
        <>
          <h1 className="mb-8 text-5xl font-bold">Entradas vs. salidas (últimos 7 días)</h1>
          <div className="w-full max-w-5xl">
            <EntradasSalidasChart data={entradasSalidas} />
          </div>
        </>
      )}
      {vista === 'stock-bajo' && (
        <>
          <h1 className="mb-8 text-5xl font-bold">Stock bajo</h1>
          <div className="w-full max-w-3xl text-2xl">
            <LowStockList productos={productosStockBajo} />
          </div>
        </>
      )}
      <div className="mt-10 flex gap-3" aria-hidden="true">
        {VISTAS.map((v) => (
          <span
            key={v}
            className={`h-2 w-2 rounded-full ${v === vista ? 'bg-foreground' : 'bg-muted-foreground/30'}`}
          />
        ))}
      </div>
    </div>
  )
}
