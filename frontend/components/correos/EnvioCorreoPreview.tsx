'use client'

import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { previsualizarEnvio } from '@/lib/supabase/correos-actions'
import { ROLE_LABELS } from '@/lib/types/database'
import type { Role } from '@/lib/types/database'

export function EnvioCorreoPreview({ rol }: { rol: Role | null }) {
  const [total, setTotal] = useState<number | null>(null)

  useEffect(() => {
    if (!rol) {
      setTotal(null)
      return
    }
    let cancelado = false
    previsualizarEnvio(rol).then((res) => {
      if (!cancelado) setTotal(res.totalDestinatarios)
    })
    return () => {
      cancelado = true
    }
  }, [rol])

  if (!rol || total === null) return null

  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      <Mail className="h-3 w-3" />
      Se enviará por correo a {total} usuario{total === 1 ? '' : 's'} del rol {ROLE_LABELS[rol]}.
    </p>
  )
}
