'use client'

import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { previsualizarEnvio } from '@/lib/supabase/correos-actions'
import { ROLE_LABELS } from '@/lib/types/database'
import type { Role } from '@/lib/types/database'

export function EnvioCorreoPreview({ rol }: { rol: Role | null }) {
  const [total, setTotal] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!rol) {
      setTotal(null)
      setError(null)
      return
    }
    let cancelado = false
    setTotal(null)
    setError(null)
    previsualizarEnvio(rol)
      .then((res) => {
        if (!cancelado) setTotal(res.totalDestinatarios)
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : 'No se pudo calcular destinatarios')
        }
      })
    return () => {
      cancelado = true
    }
  }, [rol])

  if (!rol) return null

  if (error) {
    return (
      <p className="flex items-center gap-1 text-xs text-destructive">
        <Mail className="h-3 w-3" />
        {error}
      </p>
    )
  }

  if (total === null) {
    return (
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Mail className="h-3 w-3" />
        Calculando destinatarios…
      </p>
    )
  }

  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      <Mail className="h-3 w-3" />
      Se enviará por correo a {total} usuario{total === 1 ? '' : 's'} del rol {ROLE_LABELS[rol]}.
    </p>
  )
}
