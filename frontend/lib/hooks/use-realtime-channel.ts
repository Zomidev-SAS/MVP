'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'

const DEBOUNCE_MS = 600
const POLL_FALLBACK_MS = 60_000

export function useRealtimeChannel(tablas: string[]): { conectado: boolean; ultimaActualizacion: Date | null } {
  const router = useRouter()
  const [conectado, setConectado] = useState(false)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isDevBypassActive()) return

    const supabase = createClient()
    const channel = supabase.channel('panel-realtime')

    for (const tabla of tablas) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: tabla }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          router.refresh()
          setUltimaActualizacion(new Date())
        }, DEBOUNCE_MS)
      })
    }

    channel.subscribe((status) => {
      setConectado(status === 'SUBSCRIBED')
    })

    pollRef.current = setInterval(() => {
      if (!conectado) {
        router.refresh()
        setUltimaActualizacion(new Date())
      }
    }, POLL_FALLBACK_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (pollRef.current) clearInterval(pollRef.current)
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, tablas.join(',')])

  return { conectado, ultimaActualizacion }
}
