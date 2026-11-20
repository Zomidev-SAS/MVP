'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'

const TABLAS_ALERTA: { tabla: string; mensaje: string }[] = [
  { tabla: 'ajustes_pendientes', mensaje: 'Nueva notificación: ajuste pendiente' },
  { tabla: 'ordenes_compra', mensaje: 'Nueva notificación: orden de compra' },
  { tabla: 'mensajes_panel', mensaje: 'Nuevo mensaje del panel' },
]

/**
 * Listener liviano e independiente de `RealtimePanelProvider`: su único
 * trabajo es mostrar un toast cuando llega un INSERT en una tabla relevante
 * para alertas. No llama `router.refresh()` (eso ya lo hace
 * `RealtimePanelProvider`) y no renderiza nada visible.
 */
export function NewAlertToastListener() {
  useEffect(() => {
    if (isDevBypassActive()) return

    const supabase = createClient()
    const channel = supabase.channel('alertas-toast')

    for (const { tabla, mensaje } of TABLAS_ALERTA) {
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: tabla }, () => {
        toast(mensaje)
      })
    }

    channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  return null
}
