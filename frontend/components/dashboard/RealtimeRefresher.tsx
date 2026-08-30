'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function RealtimeRefresher() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('movimientos-inventario-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movimientos_inventario' },
        () => {
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
