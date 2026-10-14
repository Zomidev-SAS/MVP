'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { marcarDiferenciaSiigoRevisada } from '@/lib/supabase/siigo-catalogo-actions'
import { formatFechaHora } from '@/lib/format'
import type { SiigoCatalogoEstado } from '@/lib/types/siigo'

const TIPO_LABELS = { producto: 'Producto', proveedor: 'Proveedor' } as const

export function SiigoCatalogoDiferencias({ estado }: { estado: SiigoCatalogoEstado }) {
  const router = useRouter()
  const [procesando, setProcesando] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRevisar(id: number) {
    setProcesando(id)
    startTransition(async () => {
      const resultado = await marcarDiferenciaSiigoRevisada(id)
      if (resultado.ok) {
        toast.success('Diferencia marcada como revisada.')
        router.refresh()
      } else {
        toast.error(resultado.error)
      }
      setProcesando(null)
    })
  }

  const sync = estado.ultimaSincronizacion

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Catálogo Siigo — diferencias</CardTitle>
        {sync && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {sync.resultado === 'error' ? (
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            )}
            <Clock className="h-3 w-3" />
            Última sincronización: {sync.fecha ? formatFechaHora(sync.fecha) : 'nunca'}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {estado.diferencias.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Sin diferencias pendientes de revisar.
          </p>
        ) : (
          <ul className="space-y-2">
            {estado.diferencias.map((d) => (
              <li
                key={d.id}
                className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{TIPO_LABELS[d.tipo]}</Badge>
                    <span className="font-mono text-xs">{d.codigo}</span>
                  </div>
                  <p className="text-muted-foreground">
                    Campo <span className="font-medium">{d.campo}</span>: panel &quot;
                    {d.valorPanel ?? '—'}&quot; vs. Siigo &quot;{d.valorSiigo ?? '—'}&quot;
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending && procesando === d.id}
                  onClick={() => handleRevisar(d.id)}
                >
                  Marcar revisado
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
