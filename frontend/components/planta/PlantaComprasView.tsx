'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  Search,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DatosPlantaCompras, OrdenFinalizadaPlanta, OrdenPlanta } from '@/lib/types/planta-compras'

const ROTACION_MS = 30_000
const VISTAS = [
  { id: 'resumen', titulo: 'Compras — resumen' },
  { id: 'ordenes', titulo: 'Órdenes en curso' },
  { id: 'finalizadas', titulo: 'Órdenes finalizadas' },
] as const

function Kpi({
  label,
  valor,
  detalle,
  icono: Icono,
}: {
  label: string
  valor: string | number
  detalle?: string
  icono: typeof ClipboardList
}) {
  return (
    <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-base text-muted-foreground">{label}</p>
        <Icono aria-hidden="true" className="h-5 w-5 text-primary" />
      </div>
      <p className="mt-1 text-4xl font-bold tabular-nums">{valor}</p>
      {detalle && <p className="text-sm text-muted-foreground">{detalle}</p>}
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

/** Para comparar nombres sin importar tildes ni mayúsculas. */
function limpiar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function Avance({ recibidas, pedidas }: { recibidas: number; pedidas: number }) {
  const porcentaje = pedidas > 0 ? Math.min(100, Math.round((recibidas / pedidas) * 100)) : 0
  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${porcentaje}%` }} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {numero(recibidas)} de {numero(pedidas)} · <span className="font-semibold text-foreground">{porcentaje}%</span>
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
    <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <button
        type="button"
        disabled={!interactiva}
        aria-expanded={interactiva ? Boolean(expandida) : undefined}
        onClick={onToggle}
        className={cn(
          'w-full p-3.5 text-left',
          lista && 'flex items-center gap-4',
          interactiva && 'transition-colors hover:bg-accent/40'
        )}
      >
        <div className={cn('flex items-start justify-between gap-3', lista ? 'min-w-0 flex-1' : '')}>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{orden.proveedor ?? 'Sin proveedor'}</p>
            <p className="text-sm text-muted-foreground">{orden.numero ?? `OC ${orden.id}`}</p>
          </div>
          <div className="shrink-0 text-right text-sm">
            <p className="text-muted-foreground">Entrega {fechaCorta(orden.fecha_vencimiento)}</p>
            {orden.requiere_firma && (
              <p className={cn('font-medium', orden.firmada ? 'text-foreground' : 'text-primary')}>
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
            className={cn('h-5 w-5 shrink-0 text-muted-foreground transition-transform', expandida && 'rotate-180')}
          />
        )}
      </button>

      {expandida && (
        <div className="space-y-2 border-t px-3.5 py-3 text-base">
          {orden.titulo && <p className="font-semibold">{orden.titulo}</p>}
          {orden.observaciones?.trim() && (
            <p className="whitespace-pre-wrap text-muted-foreground">{orden.observaciones}</p>
          )}
          {orden.items.length === 0 ? (
            <p className="text-muted-foreground">Sin líneas registradas.</p>
          ) : (
            <ul className="space-y-2">
              {orden.items.map((item, idx) => (
                <li key={`${item.codigo_producto}-${idx}`} className="rounded-lg bg-muted/60 p-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">
                      <span className="font-mono text-sm text-muted-foreground">{item.codigo_producto}</span>
                      {item.nombre_producto && <> · {item.nombre_producto}</>}
                    </p>
                    <p className="shrink-0 tabular-nums">
                      {numero(item.cantidad_recibida)} / {numero(item.cantidad)}
                    </p>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm">{item.descripcion}</p>
                  {item.observaciones?.trim() && (
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">
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

function TarjetaFinalizada({ orden }: { orden: OrdenFinalizadaPlanta }) {
  const completa = orden.pedidas > 0 && orden.recibidas >= orden.pedidas
  return (
    <div className="rounded-xl border bg-card p-3.5 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{orden.proveedor ?? 'Sin proveedor'}</p>
          <p className="text-sm text-muted-foreground">{orden.numero ?? `OC ${orden.id}`}</p>
        </div>
        <div className="shrink-0 text-right text-sm">
          <p className="flex items-center justify-end gap-1 font-semibold">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />
            Finalizada
          </p>
          <p className="text-muted-foreground">{fechaCorta(orden.fecha_cierre ?? orden.finalizada_at)}</p>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {orden.lineas} {orden.lineas === 1 ? 'línea' : 'líneas'} · {numero(orden.recibidas)} de {numero(orden.pedidas)} recibidas
        {!completa && <span className="font-semibold text-primary"> · cerrada con faltantes</span>}
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
  // Filtro por proveedor: se elige de la lista (toque) o se escribe; ambos se combinan.
  const [proveedor, setProveedor] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

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
      // Escribiendo en el buscador no se navega con las flechas ni con la barra espaciadora.
      if (e.target instanceof HTMLInputElement) return
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

  const { kpis } = datos

  // Proveedores con su número de órdenes (en curso y finalizadas), de la A a la Z.
  const proveedores = useMemo(() => {
    const cuenta = new Map<string, number>()
    for (const o of [...datos.ordenes, ...datos.finalizadas]) {
      if (!o.proveedor) continue
      cuenta.set(o.proveedor, (cuenta.get(o.proveedor) ?? 0) + 1)
    }
    return [...cuenta.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [datos.ordenes, datos.finalizadas])

  const consulta = limpiar(busqueda)
  const coincide = useCallback(
    (nombre: string | null) => {
      if (proveedor && nombre !== proveedor) return false
      if (consulta && !limpiar(nombre ?? '').includes(consulta)) return false
      return true
    },
    [proveedor, consulta]
  )
  const ordenes = useMemo(() => datos.ordenes.filter((o) => coincide(o.proveedor)), [datos.ordenes, coincide])
  const finalizadas = useMemo(
    () => datos.finalizadas.filter((o) => coincide(o.proveedor)),
    [datos.finalizadas, coincide]
  )
  const proveedoresVisibles = proveedores.filter(([nombre]) => !consulta || limpiar(nombre).includes(consulta))
  const hayFiltro = proveedor !== null || consulta !== ''

  const vista = VISTAS[indice]
  const botonNav =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-card text-foreground shadow-sm transition-colors hover:bg-accent'

  return (
    <div className="flex h-screen w-screen flex-col bg-gradient-to-br from-background via-muted to-muted-foreground/30 p-5 text-foreground">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{vista.titulo}</h1>
        <p className="text-base text-muted-foreground">
          {indice + 1} / {VISTAS.length}
        </p>
      </header>

      {proveedores.length > 0 && (
        <div
          className="mt-3 flex items-start gap-3"
          onPointerDown={() => setActividad((a) => a + 1)}
          onKeyDown={() => setActividad((a) => a + 1)}
        >
          <div className="relative shrink-0">
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar proveedor"
              aria-label="Buscar proveedor"
              className="h-8 w-52 rounded-full border bg-card pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex max-h-[4.5rem] min-w-0 flex-1 flex-wrap gap-1.5 overflow-y-auto" role="group" aria-label="Filtrar por proveedor">
            <button
              type="button"
              onClick={() => setProveedor(null)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                proveedor === null ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-accent'
              )}
            >
              Todos
            </button>
            {proveedoresVisibles.map(([nombre, total]) => (
              <button
                key={nombre}
                type="button"
                onClick={() => setProveedor((p) => (p === nombre ? null : nombre))}
                className={cn(
                  'max-w-[16rem] truncate rounded-full border px-3 py-1 text-sm transition-colors',
                  proveedor === nombre ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-accent'
                )}
              >
                {nombre} <span className="opacity-70">({total})</span>
              </button>
            ))}
            {proveedoresVisibles.length === 0 && (
              <span className="px-2 py-1 text-sm text-muted-foreground">Ningún proveedor coincide.</span>
            )}
          </div>
          {hayFiltro && (
            <button
              type="button"
              onClick={() => {
                setProveedor(null)
                setBusqueda('')
              }}
              className="flex shrink-0 items-center gap-1 rounded-full border bg-card px-3 py-1 text-sm hover:bg-accent"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
              Quitar filtro
            </button>
          )}
        </div>
      )}

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
                <Kpi label="En curso" valor={kpis.en_curso} icono={ClipboardList} />
                <Kpi label="Finalizadas" valor={kpis.finalizadas_30d} detalle="últimos 30 días" icono={CheckCircle2} />
                <Kpi
                  label="Entregas parciales"
                  valor={kpis.con_entregas_parciales}
                  detalle="órdenes con faltantes"
                  icono={PackageOpen}
                />
                <Kpi label="Por firmar" valor={kpis.pendientes_firma} icono={PenLine} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="space-y-2">
                  <h2 className="text-lg font-semibold">En curso</h2>
                  {ordenes.slice(0, 3).map((o) => (
                    <TarjetaOrden key={o.id} orden={o} />
                  ))}
                  {ordenes.length === 0 && (
                    <p className="text-base text-muted-foreground">
                      {hayFiltro ? 'Este proveedor no tiene órdenes en curso.' : 'No hay órdenes en curso.'}
                    </p>
                  )}
                </section>
                <section className="space-y-2">
                  <h2 className="text-lg font-semibold">Finalizadas recientemente</h2>
                  {finalizadas.slice(0, 3).map((o) => (
                    <TarjetaFinalizada key={o.id} orden={o} />
                  ))}
                  {finalizadas.length === 0 && (
                    <p className="text-base text-muted-foreground">
                      {hayFiltro ? 'Este proveedor no tiene órdenes finalizadas.' : 'Aún no hay órdenes finalizadas.'}
                    </p>
                  )}
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
                      'flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
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
                  <p className="col-span-full text-center text-lg text-muted-foreground">
                    {hayFiltro ? 'Este proveedor no tiene órdenes en curso.' : 'No hay órdenes en curso.'}
                  </p>
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
                  <p className="col-span-full text-center text-lg text-muted-foreground">
                    {hayFiltro ? 'Este proveedor no tiene órdenes finalizadas.' : 'Aún no hay órdenes finalizadas.'}
                  </p>
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
          className="flex h-8 w-8 items-center justify-center rounded-full border bg-card hover:bg-accent"
        >
          {automatico ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
        </button>
        {VISTAS.map((v, i) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setIndice(i)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
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
