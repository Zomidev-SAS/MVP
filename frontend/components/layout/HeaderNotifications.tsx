'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, ChevronDown, ChevronUp } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatNumber } from '@/lib/format'
import type { AlertaNotificacion } from '@/lib/types/notificaciones'

export function HeaderNotifications({ alertas }: { alertas: AlertaNotificacion[] }) {
  const [alertaAbierta, setAlertaAbierta] = useState<string | null>(alertas[0]?.id ?? null)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative text-muted-foreground hover:text-foreground"
        aria-label="Alertas"
      >
        <Bell className="h-5 w-5" />
        {alertas.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            {alertas.length > 9 ? '9+' : alertas.length}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <p className="border-b px-3 py-2 text-sm font-medium">Alertas</p>
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
                  onToggle={() =>
                    setAlertaAbierta(alertaAbierta === alerta.id ? null : alerta.id)
                  }
                />
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AlertaItem({
  alerta,
  abierta,
  onToggle,
}: {
  alerta: AlertaNotificacion
  abierta: boolean
  onToggle: () => void
}) {
  return (
    <li className="rounded-md border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-2 p-2 text-left hover:bg-accent/50"
      >
        <div>
          <p className="text-sm font-medium">{alerta.titulo}</p>
          <p className="text-xs text-muted-foreground">{alerta.resumen}</p>
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
          <Link
            href={alerta.href}
            className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
          >
            Ir a {alerta.tipo === 'stock_bajo' ? 'inventario' : 'ajustes'} →
          </Link>
        </div>
      )}
    </li>
  )
}
