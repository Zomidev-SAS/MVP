'use client'

import { useState, useTransition } from 'react'
import { RotateCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { reenviarCorreo } from '@/lib/supabase/correos-actions'
import type { CorreoEnviado } from '@/lib/types/correos'

const BADGE_POR_ESTADO: Record<CorreoEnviado['estado'], 'default' | 'destructive' | 'secondary'> = {
  enviado: 'default',
  pendiente: 'secondary',
  error: 'destructive',
}

export function CorreosTable({
  correos,
  puedeReenviar,
}: {
  correos: CorreoEnviado[]
  puedeReenviar: boolean
}) {
  const [reenviando, setReenviando] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleReenviar(id: string) {
    setReenviando(id)
    startTransition(async () => {
      await reenviarCorreo(id)
      setReenviando(null)
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Destinatario</TableHead>
          <TableHead>Asunto</TableHead>
          <TableHead>Origen</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {correos.map((correo) => (
          <TableRow key={correo.id}>
            <TableCell>
              <div className="text-sm">{correo.destinatarioNombre}</div>
              <div className="text-xs text-muted-foreground">{correo.destinatarioEmail}</div>
            </TableCell>
            <TableCell>{correo.asunto}</TableCell>
            <TableCell className="capitalize">{correo.origen}</TableCell>
            <TableCell>
              <Badge variant={BADGE_POR_ESTADO[correo.estado]}>{correo.estado}</Badge>
              {correo.error && <p className="mt-1 text-xs text-destructive">{correo.error}</p>}
            </TableCell>
            <TableCell className="text-xs">
              {correo.fechaEnvio ? new Date(correo.fechaEnvio).toLocaleString('es-CO') : '—'}
            </TableCell>
            <TableCell>
              {puedeReenviar && correo.estado === 'error' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending && reenviando === correo.id}
                  onClick={() => handleReenviar(correo.id)}
                >
                  <RotateCw className="mr-1 h-3 w-3" /> Reenviar
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
