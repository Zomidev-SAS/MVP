'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DatosPlantaCompras, OrdenPlanta } from '@/lib/types/planta-compras'

const ROTACION_MS = 30_000
const VISTAS = [
  { id: 'resumen', titulo: 'Compras — resumen' },
  { id: 'ordenes', titulo: 'Órdenes en curso' },
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

function TarjetaOrden({
  orden,
  lista,
  expandida,
  onToggle,
}: {
  orden: OrdenPlanta
  lista?: boolean
  expandida?: boolean
  onToggle?: () => void
}) {
  const porcentaje = orden.pedidas > 0 ? Math.min(100, Math.round((orden.recibidas / orden.pedidas) * 100)) : 0
  const vencida = estaVencida(orden)
  const interactiva = Boolean(onToggle)
  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm', vencida && 'border-destructive/60')}>
      <button
        type="button"
        disabled={!interactiva}
        aria-expanded={interactiva ? Boolean(expandida) : undefined}
        onClick={onToggle}
        className={cn(
          'w-full p-5 text-left',
          lista && 'flex items-center gap-6',
          interactiva && 'rounded-2xl transition-colors hover:bg-accent/40'
        )}
      >
        <div className={cn('flex items-start justify-between gap-3', lista ? 'min-w-0 flex-1' : '')}>
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
        <div className={cn(lista ? 'w-1/3 shrink-0' : 'mt-4')}>
          <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${porcentaje}%` }} />
          </div>
          <p className="mt-2 text-xl">
            Recibidas {numero(orden.recibidas)} de {numero(orden.pedidas)} ·{' '}
            <span className="font-semibold">Restan {numero(Math.max(orden.pedidas - orden.recibidas, 0))}</span>
            {orden.ultima_entrega && !lista && (
              <span className="text-muted-foreground"> · última entrega {fechaCorta(orden.ultima_entrega)}</span>
            )}
          </p>
        </div>
        {interactiva && (
          <ChevronDown
            aria-hidden="true"
            className={cn('h-7 w-7 shrink-0 text-muted-foreground transition-transform', expandida && 'rotate-180', !lista && 'hidden')}
          />
        )}
      </button>

      {expandida && (
        <div className="space-y-3 border-t px-5 py-4 text-xl">
          {orden.titulo && <p className="font-semibold">{orden.titulo}</p>}
          {orden.observaciones?.trim() && (
            <p className="whitespace-pre-wrap text-muted-foreground">{orden.observaciones}</p>
          )}
          {orden.items.length === 0 ? (
            <p className="text-muted-foreground">Sin líneas registradas.</p>
          ) : (
            <ul className="space-y-3">
              {orden.items.map((item, idx) => (
                <li key={`${item.codigo_producto}-${idx}`} className="rounded-xl bg-muted/50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <p className="font-semibold">
                      <span className="font-mono text-lg text-muted-foreground">{item.codigo_producto}</span>
                      {item.nombre_producto && <> · {item.nombre_producto}</>}
                    </p>
                    <p className="shrink-0 tabular-nums">
                      {numero(item.cantidad_recibida)} / {numero(item.cantidad)}
                    </p>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{item.descripcion}</p>
                  {item.proveedor_nombre && (
                    <p className="mt-1 text-lg text-muted-foreground">Proveedor: {item.proveedor_nombre}</p>
                  )}
                  {item.observaciones?.trim() && (
                    <p className="mt-1 whitespace-pre-wrap text-lg text-muted-foreground">
                      Obs.: {item.observaciones}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export function PlantaComprasView({ datos }: { datos: DatosPlantaCompras }) {
  const router = useRouter()
  const [indice, setIndice] = useState(0)
  const [automatico, setAutomatico] = useState(true)
  const [actividad, setActividad] = useState(0)
  const [modoOrdenes, setModoOrdenes] = useState<'mosaico' | 'lista'>('mosaico')
  const [abiertaId, setAbiertaId] = useState<number | null>(null)

  // Pantalla sin sesión: polling simple, igual que la TV del taller.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000)
    return () => clearInterval(id)
  }, [router])

  const ir = useCallback((delta: number) => {
    setIndice((i) => (i + delta + VISTAS.length) % VISTAS.length)
  }, [])

  useEffect(() => {
    // Con una orden abierta no se rota: se está leyendo el detalle.
    if (!automatico || abiertaId !== null) return
    const id = setTimeout(() => ir(1), ROTACION_MS)
    return () => clearTimeout(id)
  }, [automatico, abiertaId, indice, ir, actividad])

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
  const { kpis, ordenes } = datos
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
            <div className="mx-auto w-full max-w-7xl space-y-4">
              <div className="flex justify-end gap-2">
                {([
                  ['mosaico', LayoutGrid, 'Mosaico'],
                  ['lista', List, 'Lista'],
                ] as const).map(([id, Icono, texto]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setModoOrdenes(id)}
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-4 py-1.5 text-base transition-colors',
                      modoOrdenes === id ? 'bg-foreground text-background' : 'bg-card text-muted-foreground hover:bg-accent'
                    )}
                  >
                    <Icono aria-hidden="true" className="h-4 w-4" />
                    {texto}
                  </button>
                ))}
              </div>
              <div
                className={cn(
                  'grid grid-cols-1 items-start gap-4',
                  modoOrdenes === 'mosaico' && 'xl:grid-cols-2 2xl:grid-cols-3'
                )}
              >
                {ordenes.map((o) => (
                  <TarjetaOrden
                    key={o.id}
                    orden={o}
                    lista={modoOrdenes === 'lista'}
                    expandida={abiertaId === o.id}
                    onToggle={() => setAbiertaId((id) => (id === o.id ? null : o.id))}
                  />
                ))}
                {ordenes.length === 0 && (
                  <p className="col-span-full text-center text-2xl text-muted-foreground">
                    No hay órdenes en curso.
                  </p>
                )}
              </div>
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
