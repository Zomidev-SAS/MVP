'use client'

const formatoHora = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function LiveIndicator({ conectado, ultimaActualizacion }: { conectado: boolean; ultimaActualizacion: Date | null }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-success' : 'bg-muted-foreground'}`} />
      {conectado ? 'En vivo' : 'Reconectando…'}
      {ultimaActualizacion && ` · actualizado ${formatoHora.format(ultimaActualizacion)}`}
    </span>
  )
}
