'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, ChevronDown, ChevronUp, CheckCheck, Mail } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatNumber } from '@/lib/format'
import { marcarNotificacionLeida, marcarTodasLeidas } from '@/lib/supabase/notificaciones-actions'
import type { AlertaNotificacion } from '@/lib/types/notificaciones'

export function HeaderNotifications({
  alertas,
  leidas: leidasIniciales,
}: {
  alertas: AlertaNotificacion[]
  leidas: Set<string>
}) {
  const [alertaAbierta, setAlertaAbierta] = useState<string | null>(alertas[0]?.id ?? null)
  const [leidas, setLeidas] = useState<Set<string>>(leidasIniciales)

  const sinLeer = alertas.filter((a) => !leidas.has(a.id)).length

  function marcarUna(id: string) {
    setLeidas((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
    void marcarNotificacionLeida(id)
  }

  function marcarTodas() {
    const ids = alertas.map((a) => a.id)
    setLeidas(new Set(ids))
    void marcarTodasLeidas(ids)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative text-muted-foreground hover:text-foreground"
        aria-label="Alertas"
      >
        <Bell className="h-5 w-5" />
        {sinLeer > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Alertas</p>
          <button
            type="button"
            onClick={marcarTodas}
            disabled={sinLeer === 0}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Marcar todas
          </button>
        </div>
        <div className="max-h-[24rem] overflow-y-auto p-2">
          {alertas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin alertas activas.</p>
          ) : (
            <ul className="space-y-2">
              {alertas.map((alerta) => (
                <AlertaItem
                  key={alerta.id}
                  alerta={alerta}
                  abierta={alertaAbierta === alerta.id}
                  leida={leidas.has(alerta.id)}
                  onToggle={() =>
                    setAlertaAbierta(alertaAbierta === alerta.id ? null : alerta.id)
                  }
                  onMarcarLeida={() => marcarUna(alerta.id)}
                />
              ))}
            </ul>
          )}
        </div>
        <Link
          href="/notificaciones"
          className="block border-t px-3 py-2 text-center text-xs font-medium text-primary hover:underline"
        >
          Ver historial completo
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AlertaItem({
  alerta,
  abierta,
  leida,
  onToggle,
  onMarcarLeida,
}: {
  alerta: AlertaNotificacion
  abierta: boolean
  leida: boolean
  onToggle: () => void
  onMarcarLeida: () => void
}) {
  return (
    <li className={`rounded-md border ${leida ? 'opacity-60' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-2 p-2 text-left hover:bg-accent/50"
      >
        <div>
          <p className="text-sm font-medium">{alerta.titulo}</p>
          <p className="text-xs text-muted-foreground">{alerta.resumen}</p>
          {alerta.correoEnviado && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              {alerta.correoEnviado.enviado
                ? `Correo enviado ${
                    alerta.correoEnviado.fecha
                      ? new Date(alerta.correoEnviado.fecha).toLocaleString('es-CO')
                      : ''
                  }`
                : 'Correo pendiente'}
            </p>
          )}
        </div>
        {abierta ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {abierta && (
        <div className="border-t px-2 pb-2 pt-1">
          {alerta.tipo === 'stock_bajo' && (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
              {alerta.productos.map((p) => (
                <li key={p.codigo_producto} className="flex justify-between gap-2">
                  <span className="truncate font-mono">{p.codigo_producto}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {p.nombre_producto ?? '—'} · saldo {formatNumber(p.saldo)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {alerta.tipo === 'ajustes_pendientes' && (
            <p className="text-xs text-muted-foreground">
              {alerta.cantidad} ajuste(s) requieren revisión del supervisor.
            </p>
          )}
          {alerta.tipo === 'ordenes_compra' && (
            <ul className="max-h-40 space-y-2 overflow-y-auto text-xs">
              {alerta.ordenes.map((o) => (
                <li key={o.id} className="rounded border px-2 py-1.5">
                  <p className="font-medium">
                    #{o.id} · {o.codigo_producto}
                  </p>
                  <p className="text-muted-foreground">
                    {o.descripcion} · {o.cantidad} uds · {o.fecha_pedido}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {alerta.tipo === 'eventos_hoy' && (
            <ul className="max-h-40 space-y-2 overflow-y-auto text-xs">
              {alerta.eventos.map((e) => (
                <li key={e.id} className="rounded border px-2 py-1.5">
                  <p className="font-medium">{e.titulo}</p>
                  {e.fecha_fin && e.fecha_fin !== e.fecha ? (
                    <p className="text-muted-foreground">
                      Rango: {e.fecha} → {e.fecha_fin}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">{e.fecha}</p>
                  )}
                  {e.nota && <p className="mt-0.5 text-muted-foreground">{e.nota}</p>}
                </li>
              ))}
            </ul>
          )}
          <Link
            href={alerta.href}
            onClick={onMarcarLeida}
            className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
          >
            Ir a{' '}
            {alerta.tipo === 'stock_bajo'
              ? 'inventario'
              : alerta.tipo === 'ordenes_compra'
                ? 'compras'
              : alerta.tipo === 'eventos_hoy'
                ? 'calendario'
                : 'ajustes'}{' '}
            →
          </Link>
        </div>
      )}
    </li>
  )
}
