'use client'

import { AlertTriangle, Clock, PackageCheck, PenLine, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resumenRecepcion, type OrdenCompra } from '@/lib/types/orden-compra'

export type FiltroCompras =
  | 'todas'
  | 'proceso'
  | 'vencidas'
  | 'porfirmar'
  | 'parciales'
  | 'finalizadas'
  | 'canceladas'

function hoyInicio(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function estaVencida(o: OrdenCompra): boolean {
  return o.estado === 'en_curso' && !!o.fecha_vencimiento && new Date(`${o.fecha_vencimiento}T12:00:00`) < hoyInicio()
}

export function estaPorFirmar(o: OrdenCompra): boolean {
  return o.estado === 'en_curso' && !!o.documento_path && !o.firmada_at
}

export function tieneEntregasParciales(o: OrdenCompra): boolean {
  return o.estado === 'en_curso' && o.items.some((i) => resumenRecepcion(i).parcial)
}

export function coincideFiltro(o: OrdenCompra, f: FiltroCompras): boolean {
  switch (f) {
    case 'todas':
      return true
    case 'proceso':
      return o.estado === 'en_curso'
    case 'vencidas':
      return estaVencida(o)
    case 'porfirmar':
      return estaPorFirmar(o)
    case 'parciales':
      return tieneEntregasParciales(o)
    case 'finalizadas':
      return o.estado === 'listo'
    case 'canceladas':
      return o.estado === 'cancelada'
  }
}

interface TarjetaProps {
  icono: LucideIcon
  etiqueta: string
  valor: number
  detalle: string
  activa: boolean
  alerta?: boolean
  onClick: () => void
}

function Tarjeta({ icono: Icono, etiqueta, valor, detalle, activa, alerta, onClick }: TarjetaProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={cn(
        'group flex flex-col gap-1 rounded-xl border bg-card p-3 text-left shadow-sm transition-all',
        'hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        activa && 'border-primary ring-1 ring-primary',
        alerta && valor > 0 && !activa && 'border-destructive/50'
      )}
    >
      <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        {etiqueta}
        <Icono
          aria-hidden
          className={cn('h-4 w-4', alerta && valor > 0 ? 'text-destructive' : 'text-muted-foreground')}
        />
      </span>
      <span className={cn('text-3xl font-bold tabular-nums leading-none', alerta && valor > 0 && 'text-destructive')}>
        {valor}
      </span>
      <span className="text-xs text-muted-foreground">{detalle}</span>
    </button>
  )
}

interface ResumenComprasProps {
  ordenes: OrdenCompra[]
  filtro: FiltroCompras
  onFiltro: (f: FiltroCompras) => void
}

/** Tarjetas con lo que importa hoy; cada una filtra la lista al tocarla. */
export function ResumenCompras({ ordenes, filtro, onFiltro }: ResumenComprasProps) {
  const enProceso = ordenes.filter((o) => o.estado === 'en_curso')
  const pedidas = enProceso.reduce((a, o) => a + o.items.reduce((s, i) => s + Number(i.cantidad || 0), 0), 0)
  const recibidas = enProceso.reduce(
    (a, o) => a + o.items.reduce((s, i) => s + Math.min(Number(i.cantidad_recibida ?? 0), Number(i.cantidad || 0)), 0),
    0
  )
  const pct = pedidas > 0 ? Math.round((recibidas / pedidas) * 100) : 0

  const alternar = (f: FiltroCompras) => onFiltro(filtro === f ? 'todas' : f)

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Tarjeta
        icono={Clock}
        etiqueta="En proceso"
        valor={enProceso.length}
        detalle="órdenes abiertas"
        activa={filtro === 'proceso'}
        onClick={() => alternar('proceso')}
      />
      <Tarjeta
        icono={AlertTriangle}
        etiqueta="Vencidas"
        valor={ordenes.filter(estaVencida).length}
        detalle="pasaron su fecha"
        activa={filtro === 'vencidas'}
        alerta
        onClick={() => alternar('vencidas')}
      />
      <Tarjeta
        icono={PenLine}
        etiqueta="Por firmar"
        valor={ordenes.filter(estaPorFirmar).length}
        detalle="esperan al administrador"
        activa={filtro === 'porfirmar'}
        onClick={() => alternar('porfirmar')}
      />
      <Tarjeta
        icono={PackageCheck}
        etiqueta="Entregas parciales"
        valor={ordenes.filter(tieneEntregasParciales).length}
        detalle="con faltantes"
        activa={filtro === 'parciales'}
        onClick={() => alternar('parciales')}
      />
      <div className="col-span-2 flex flex-col justify-between gap-2 rounded-xl border bg-card p-3 shadow-sm lg:col-span-1">
        <span className="text-xs font-medium text-muted-foreground">Avance de recepción</span>
        <span className="text-3xl font-bold tabular-nums leading-none">{pct}%</span>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {recibidas.toLocaleString('es-CO')} de {pedidas.toLocaleString('es-CO')} unidades
        </span>
      </div>
    </div>
  )
}
