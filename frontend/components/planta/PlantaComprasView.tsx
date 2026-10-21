'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { LowStockList } from '@/components/dashboard/LowStockList'
import { cn } from '@/lib/utils'
import type { DatosPlantaCompras, OrdenPlanta } from '@/lib/types/planta-compras'

const ROTACION_MS = 30_000
const VISTAS = [
  { id: 'resumen', titulo: 'Compras — resumen' },
  { id: 'ordenes', titulo: 'Órdenes en curso' },
  { id: 'stock-bajo', titulo: 'Por reponer (stock bajo)' },
] as const

function Kpi({
  label,
  valor,
  detalle,
  alerta,
}: {
  label: string
  valor: string | number
  detalle?: string
  alerta?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-card p-6 text-card-foreground shadow-sm',
        alerta && 'border-destructive/60'
      )}
    >
      <p className="text-xl text-muted-foreground">{label}</p>
      <p className={cn('mt-2 text-6xl font-bold tabular-nums', alerta && 'text-destructive')}>{valor}</p>
      {detalle && <p className="mt-2 text-lg text-muted-foreground">{detalle}</p>}
    </div>
  )
}

function fechaCorta(valor: string | null): string {
  if (!valor) return '—'
  const d = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

function estaVencida(orden: OrdenPlanta): boolean {
  if (!orden.fecha_vencimiento) return false
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return new Date(`${orden.fecha_vencimiento}T12:00:00`) < hoy
}

function numero(n: number): string {
  return n.toLocaleString('es-CO', { maximumFractionDigits: 2 })
}

function TarjetaOrden({ orden }: { orden: OrdenPlanta }) {
  const porcentaje = orden.pedidas > 0 ? Math.min(100, Math.round((orden.recibidas / orden.pedidas) * 100)) : 0
  const vencida = estaVencida(orden)
  return (
    <div className={cn('rounded-2xl border bg-card p-5 shadow-sm', vencida && 'border-destructive/60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-2xl font-semibold">{orden.proveedor ?? 'Sin proveedor'}</p>
          <p className="text-lg text-muted-foreground">{orden.numero ?? `OC ${orden.id}`}</p>
        </div>
        <div className="shrink-0 text-right text-lg">
          <p className={cn(vencida && 'font-bold text-destructive')}>
            {vencida ? 'Vencida' : 'Vence'} {fechaCorta(orden.fecha_vencimiento)}
          </p>
          {orden.requiere_firma && (
            <p className={cn('font-medium', orden.firmada ? 'text-emerald-700' : 'text-amber-600')}>
              {orden.firmada ? 'Firmada' : 'Pendiente de firma'}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${porcentaje}%` }} />
      </div>
      <p className="mt-2 text-xl">
        Recibidas {numero(orden.recibidas)} de {numero(orden.pedidas)} ·{' '}
        <span className="font-semibold">Restan {numero(Math.max(orden.pedidas - orden.recibidas, 0))}</span>
        {orden.ultima_entrega && (
          <span className="text-muted-foreground"> · última entrega {fechaCorta(orden.ultima_entrega)}</span>
        )}
      </p>
    </div>
  )
}

export function PlantaComprasView({ datos }: { datos: DatosPlantaCompras }) {
  const router = useRouter()
  const [indice, setIndice] = useState(0)
  const [automatico, setAutomatico] = useState(true)
  const [actividad, setActividad] = useState(0)

  // Pantalla sin sesión: polling simple, igual que la TV del taller.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000)
    return () => clearInterval(id)
  }, [router])

  const ir = useCallback((delta: number) => {
    setIndice((i) => (i + delta + VISTAS.length) % VISTAS.length)
  }, [])

  useEffect(() => {
    if (!automatico) return
    const id = setTimeout(() => ir(1), ROTACION_MS)
    return () => clearTimeout(id)
  }, [automatico, indice, ir, actividad])

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
  const { kpis, ordenes, productosStockBajo } = datos
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

        <div
          className="h-full min-w-0 flex-1 overflow-y-auto"
          onPointerDown={() => setActividad((a) => a + 1)}
          onKeyDown={() => setActividad((a) => a + 1)}
        >
          {vista.id === 'resumen' && (
            <div className="grid h-full grid-cols-1 content-center gap-6 lg:grid-cols-2">
              <div className="grid grid-cols-2 gap-6">
                <Kpi label="Órdenes en curso" valor={kpis.en_curso} />
                <Kpi label="Vencidas" valor={kpis.vencidas} alerta={kpis.vencidas > 0} />
                <Kpi label="Entregas parciales" valor={kpis.con_entregas_parciales} detalle="órdenes con faltantes" />
                <Kpi label="Pendientes de firma" valor={kpis.pendientes_firma} />
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
              <div className="space-y-4">
                {ordenes.slice(0, 3).map((o) => (
                  <TarjetaOrden key={o.id} orden={o} />
                ))}
                {ordenes.length === 0 && (
                  <p className="text-center text-2xl text-muted-foreground">No hay órdenes en curso.</p>
                )}
              </div>
            </div>
          )}
          {vista.id === 'ordenes' && (
            <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 xl:grid-cols-2">
              {ordenes.map((o) => (
                <TarjetaOrden key={o.id} orden={o} />
              ))}
              {ordenes.length === 0 && (
                <p className="col-span-full text-center text-2xl text-muted-foreground">
                  No hay órdenes en curso.
                </p>
              )}
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
          {automatico ? <Pause aria-hidden="true" className="h-5 w-5" /> : <Play aria-hidden="true" className="h-5 w-5" />}
        </button>
        {VISTAS.map((v, i) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setIndice(i)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-base transition-colors',
              i === indice ? 'bg-foreground text-background' : 'bg-card text-muted-foreground hover:bg-accent'
            )}
          >
            {v.titulo}
          </button>
        ))}
      </footer>
    </div>
  )
}
