'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { createClient } from '@/lib/supabase/client'

const DEBOUNCE_MS = 600

export function RealtimeRefresher() {
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isDevBypassActive()) return

    const supabase = createClient()
    const channel = supabase
      .channel('movimientos-inventario-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movimientos_inventario' },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => router.refresh(), DEBOUNCE_MS)
        }
      )
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      void supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
