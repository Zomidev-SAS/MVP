'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  marcarMensajeLeido,
  marcarNotificacionLeida,
} from '@/lib/supabase/notificaciones-actions'
import type { AlertaNotificacion, MensajePanel } from '@/lib/types/notificaciones'

interface NotificacionesHistorialProps {
  alertas: AlertaNotificacion[]
  mensajes: MensajePanel[]
}

type FiltroLeida = 'todas' | 'no_leidas' | 'leidas'
type FiltroTipo = 'todos' | AlertaNotificacion['tipo']

const TIPO_LABELS: Record<AlertaNotificacion['tipo'], string> = {
  stock_bajo: 'Stock bajo',
  ajustes_pendientes: 'Ajustes pendientes',
  ordenes_compra: 'Órdenes de compra',
  eventos_hoy: 'Eventos de hoy',
}

const DESTINO_LABELS: Record<AlertaNotificacion['tipo'], string> = {
  stock_bajo: 'inventario',
  ordenes_compra: 'compras',
  eventos_hoy: 'calendario',
  ajustes_pendientes: 'ajustes',
}

export function NotificacionesHistorial({ alertas, mensajes }: NotificacionesHistorialProps) {
  const [leidas, setLeidas] = useState<Set<string>>(new Set())
  const [mensajesLeidos, setMensajesLeidos] = useState<Set<number>>(
    new Set(mensajes.filter((m) => m.leido).map((m) => m.id))
  )
  const [filtroLeida, setFiltroLeida] = useState<FiltroLeida>('todas')
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')

  function marcarAlertaLeida(id: string) {
    setLeidas((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
    void marcarNotificacionLeida(id)
  }

  function marcarMensaje(id: number) {
    setMensajesLeidos((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
    void marcarMensajeLeido(id)
  }

  const alertasFiltradas = useMemo(() => {
    return alertas.filter((a) => {
      const leida = leidas.has(a.id)
      if (filtroLeida === 'no_leidas' && leida) return false
      if (filtroLeida === 'leidas' && !leida) return false
      if (filtroTipo !== 'todos' && a.tipo !== filtroTipo) return false
      return true
    })
  }, [alertas, leidas, filtroLeida, filtroTipo])

  const mensajesFiltrados = useMemo(() => {
    if (filtroTipo !== 'todos') return []
    return mensajes.filter((m) => {
      const leido = mensajesLeidos.has(m.id)
      if (filtroLeida === 'no_leidas' && leido) return false
      if (filtroLeida === 'leidas' && !leido) return false
      return true
    })
  }, [mensajes, mensajesLeidos, filtroLeida, filtroTipo])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notificaciones</h1>
        <p className="text-muted-foreground">Historial de alertas y mensajes internos</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={filtroLeida} onValueChange={(v) => setFiltroLeida(v as FiltroLeida)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="no_leidas">No leídas</SelectItem>
            <SelectItem value="leidas">Leídas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as FiltroTipo)}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {Object.entries(TIPO_LABELS).map(([tipo, label]) => (
              <SelectItem key={tipo} value={tipo}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Alertas</h2>
        {alertasFiltradas.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sin alertas para este filtro.
          </p>
        ) : (
          <ul className="space-y-2">
            {alertasFiltradas.map((alerta) => {
              const leida = leidas.has(alerta.id)
              return (
                <li key={alerta.id} className={`rounded-md border p-3 ${leida ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
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
                    <Link
                      href={alerta.href}
                      onClick={() => marcarAlertaLeida(alerta.id)}
                      className="shrink-0 text-xs font-medium text-primary hover:underline"
                    >
                      Ir a {DESTINO_LABELS[alerta.tipo]} →
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Mensajes internos</h2>
        {mensajesFiltrados.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sin mensajes para este filtro.
          </p>
        ) : (
          <ul className="space-y-2">
            {mensajesFiltrados.map((mensaje) => {
              const leido = mensajesLeidos.has(mensaje.id)
              return (
                <li
                  key={mensaje.id}
                  className={`rounded-md border p-3 ${leido ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{mensaje.titulo}</p>
                      <p className="text-xs text-muted-foreground">{mensaje.cuerpo}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(mensaje.created_at).toLocaleString('es-CO')}
                      </p>
                    </div>
                    {!leido && (
                      <button
                        type="button"
                        onClick={() => marcarMensaje(mensaje.id)}
                        className="shrink-0 text-xs font-medium text-primary hover:underline"
                      >
                        Marcar leído
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
