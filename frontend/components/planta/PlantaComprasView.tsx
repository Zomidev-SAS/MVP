'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  List,
  PackageOpen,
  Pause,
  PenLine,
  Play,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DatosPlantaCompras, OrdenFinalizadaPlanta, OrdenPlanta } from '@/lib/types/planta-compras'

const ROTACION_MS = 30_000
const VISTAS = [
  { id: 'resumen', titulo: 'Compras — resumen' },
  { id: 'ordenes', titulo: 'Órdenes en curso' },
  { id: 'finalizadas', titulo: 'Órdenes finalizadas' },
] as const

type ColorKpi = 'sky' | 'emerald' | 'amber' | 'violet'

const FONDO_KPI: Record<ColorKpi, string> = {
  sky: 'from-sky-500 to-blue-700',
  emerald: 'from-emerald-500 to-teal-700',
  amber: 'from-amber-400 to-orange-600',
  violet: 'from-violet-500 to-fuchsia-700',
}

function Kpi({
  label,
  valor,
  detalle,
  color,
  icono: Icono,
}: {
  label: string
  valor: string | number
  detalle?: string
  color: ColorKpi
  icono: typeof ClipboardList
}) {
  return (
    <div className={cn('rounded-xl bg-gradient-to-br p-4 text-white shadow-lg', FONDO_KPI[color])}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-medium text-white/90">{label}</p>
        <Icono aria-hidden="true" className="h-5 w-5 text-white/80" />
      </div>
      <p className="mt-1 text-4xl font-bold tabular-nums">{valor}</p>
      {detalle && <p className="text-sm text-white/80">{detalle}</p>}
    </div>
  )
}

function fechaCorta(valor: string | null): string {
  if (!valor) return '—'
  const d = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })
}

function numero(n: number): string {
  return n.toLocaleString('es-CO', { maximumFractionDigits: 2 })
}

/** Rojo al empezar, ámbar a medias, verde al completar: el avance se lee por el color. */
function colorAvance(porcentaje: number): string {
  if (porcentaje >= 100) return 'bg-emerald-400'
  if (porcentaje >= 34) return 'bg-amber-400'
  return 'bg-rose-400'
}

function Avance({ recibidas, pedidas }: { recibidas: number; pedidas: number }) {
  const porcentaje = pedidas > 0 ? Math.min(100, Math.round((recibidas / pedidas) * 100)) : 0
  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/15">
        <div className={cn('h-full rounded-full', colorAvance(porcentaje))} style={{ width: `${porcentaje}%` }} />
      </div>
      <p className="mt-1 text-sm text-slate-200">
        {numero(recibidas)} de {numero(pedidas)} · <span className="font-semibold">{porcentaje}%</span>
      </p>
    </div>
  )
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
  const interactiva = Boolean(onToggle)
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/10 text-white shadow-md backdrop-blur">
      <button
        type="button"
        disabled={!interactiva}
        aria-expanded={interactiva ? Boolean(expandida) : undefined}
        onClick={onToggle}
        className={cn(
          'w-full p-3.5 text-left',
          lista && 'flex items-center gap-4',
          interactiva && 'transition-colors hover:bg-white/10'
        )}
      >
        <div className={cn('flex items-start justify-between gap-3', lista ? 'min-w-0 flex-1' : '')}>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{orden.proveedor ?? 'Sin proveedor'}</p>
            <p className="text-sm text-sky-200">{orden.numero ?? `OC ${orden.id}`}</p>
          </div>
          <div className="shrink-0 text-right text-sm">
            <p className="text-slate-200">Entrega {fechaCorta(orden.fecha_vencimiento)}</p>
            {orden.requiere_firma && (
              <p className={cn('font-semibold', orden.firmada ? 'text-emerald-300' : 'text-amber-300')}>
                {orden.firmada ? 'Firmada' : 'Por firmar'}
              </p>
            )}
          </div>
        </div>
        <div className={cn(lista ? 'w-1/3 shrink-0' : 'mt-3')}>
          <Avance recibidas={orden.recibidas} pedidas={orden.pedidas} />
        </div>
        {interactiva && lista && (
          <ChevronDown
            aria-hidden="true"
            className={cn('h-5 w-5 shrink-0 text-slate-300 transition-transform', expandida && 'rotate-180')}
          />
        )}
      </button>

      {expandida && (
        <div className="space-y-2 border-t border-white/10 px-3.5 py-3 text-base">
          {orden.titulo && <p className="font-semibold">{orden.titulo}</p>}
          {orden.observaciones?.trim() && (
            <p className="whitespace-pre-wrap text-slate-200">{orden.observaciones}</p>
          )}
          {orden.items.length === 0 ? (
            <p className="text-slate-300">Sin líneas registradas.</p>
          ) : (
            <ul className="space-y-2">
              {orden.items.map((item, idx) => (
                <li key={`${item.codigo_producto}-${idx}`} className="rounded-lg bg-black/25 p-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">
                      <span className="font-mono text-sm text-sky-200">{item.codigo_producto}</span>
                      {item.nombre_producto && <> · {item.nombre_producto}</>}
                    </p>
                    <p className="shrink-0 tabular-nums text-amber-200">
                      {numero(item.cantidad_recibida)} / {numero(item.cantidad)}
                    </p>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-200">{item.descripcion}</p>
                  {item.observaciones?.trim() && (
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-300">Obs.: {item.observaciones}</p>
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

function TarjetaFinalizada({ orden }: { orden: OrdenFinalizadaPlanta }) {
  const completa = orden.pedidas > 0 && orden.recibidas >= orden.pedidas
  return (
    <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/15 p-3.5 text-white shadow-md backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{orden.proveedor ?? 'Sin proveedor'}</p>
          <p className="text-sm text-emerald-200">{orden.numero ?? `OC ${orden.id}`}</p>
        </div>
        <div className="shrink-0 text-right text-sm">
          <p className="flex items-center justify-end gap-1 font-semibold text-emerald-300">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            Finalizada
          </p>
          <p className="text-slate-200">{fechaCorta(orden.finalizada_at)}</p>
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-200">
        {orden.lineas} {orden.lineas === 1 ? 'línea' : 'líneas'} · {numero(orden.recibidas)} de {numero(orden.pedidas)} recibidas
        {!completa && <span className="font-semibold text-amber-300"> · cerrada con faltantes</span>}
      </p>
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
  const { kpis, ordenes, finalizadas } = datos
  const botonNav =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20'

  return (
    <div className="flex h-screen w-screen flex-col bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 text-white">
      <header className="flex items-center justify-between">
        <h1 className="bg-gradient-to-r from-sky-300 via-emerald-300 to-amber-300 bg-clip-text text-3xl font-bold text-transparent">
          {vista.titulo}
        </h1>
        <p className="text-base text-slate-300">
          {indice + 1} / {VISTAS.length}
        </p>
      </header>

      <main className="flex min-h-0 flex-1 items-center gap-4 py-4">
        <button type="button" aria-label="Vista anterior" onClick={() => ir(-1)} className={botonNav}>
          <ChevronLeft aria-hidden="true" className="h-6 w-6" />
        </button>

        <div
          className="h-full min-w-0 flex-1 overflow-y-auto"
          onPointerDown={() => setActividad((a) => a + 1)}
          onKeyDown={() => setActividad((a) => a + 1)}
        >
          {vista.id === 'resumen' && (
            <div className="flex h-full flex-col justify-center gap-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label="En curso" valor={kpis.en_curso} color="sky" icono={ClipboardList} />
                <Kpi
                  label="Finalizadas"
                  valor={kpis.finalizadas_30d}
                  detalle="últimos 30 días"
                  color="emerald"
                  icono={CheckCircle2}
                />
                <Kpi
                  label="Entregas parciales"
                  valor={kpis.con_entregas_parciales}
                  detalle="órdenes con faltantes"
                  color="amber"
                  icono={PackageOpen}
                />
                <Kpi label="Por firmar" valor={kpis.pendientes_firma} color="violet" icono={PenLine} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="space-y-2">
                  <h2 className="text-lg font-semibold text-sky-300">En curso</h2>
                  {ordenes.slice(0, 3).map((o) => (
                    <TarjetaOrden key={o.id} orden={o} />
                  ))}
                  {ordenes.length === 0 && <p className="text-base text-slate-300">No hay órdenes en curso.</p>}
                </section>
                <section className="space-y-2">
                  <h2 className="text-lg font-semibold text-emerald-300">Finalizadas recientemente</h2>
                  {finalizadas.slice(0, 3).map((o) => (
                    <TarjetaFinalizada key={o.id} orden={o} />
                  ))}
                  {finalizadas.length === 0 && <p className="text-base text-slate-300">Aún no hay órdenes finalizadas.</p>}
                </section>
              </div>
            </div>
          )}
          {vista.id === 'ordenes' && (
            <div className="mx-auto w-full max-w-7xl space-y-3">
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
                      'flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 text-sm transition-colors',
                      modoOrdenes === id ? 'bg-sky-500 text-white' : 'bg-white/10 text-slate-200 hover:bg-white/20'
                    )}
                  >
                    <Icono aria-hidden="true" className="h-4 w-4" />
                    {texto}
                  </button>
                ))}
              </div>
              <div
                className={cn(
                  'grid grid-cols-1 items-start gap-3',
                  modoOrdenes === 'mosaico' && 'lg:grid-cols-2 2xl:grid-cols-3'
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
                  <p className="col-span-full text-center text-lg text-slate-300">No hay órdenes en curso.</p>
                )}
              </div>
            </div>
          )}
          {vista.id === 'finalizadas' && (
            <div className="mx-auto w-full max-w-7xl">
              <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {finalizadas.map((o) => (
                  <TarjetaFinalizada key={o.id} orden={o} />
                ))}
                {finalizadas.length === 0 && (
                  <p className="col-span-full text-center text-lg text-slate-300">Aún no hay órdenes finalizadas.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <button type="button" aria-label="Vista siguiente" onClick={() => ir(1)} className={botonNav}>
          <ChevronRight aria-hidden="true" className="h-6 w-6" />
        </button>
      </main>

      <footer className="flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label={automatico ? 'Pausar rotación' : 'Reanudar rotación'}
          onClick={() => setAutomatico((a) => !a)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
        >
          {automatico ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
        </button>
        {VISTAS.map((v, i) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setIndice(i)}
            className={cn(
              'rounded-full border border-white/20 px-3 py-1 text-sm transition-colors',
              i === indice ? 'bg-white text-slate-900' : 'bg-white/10 text-slate-200 hover:bg-white/20'
            )}
          >
            {v.titulo}
          </button>
        ))}
      </footer>
    </div>
  )
}
