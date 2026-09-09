'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ErrorState({
  message = 'Ocurrió un error inesperado.',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <p className="text-lg font-medium">{message}</p>
      <p className="text-sm text-muted-foreground">
        Intenta de nuevo. Si el problema persiste, contacta a soporte.
      </p>
      {onRetry && (
        <Button type="button" variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}
