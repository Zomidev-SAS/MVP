'use client'

import { useRealtimeChannel } from '@/lib/hooks/use-realtime-channel'
import { LiveIndicator } from '@/components/dashboard/LiveIndicator'

export function RealtimePanelProvider({ tablas }: { tablas: string[] }) {
  const { conectado, ultimaActualizacion } = useRealtimeChannel(tablas)
  return <LiveIndicator conectado={conectado} ultimaActualizacion={ultimaActualizacion} />
}
