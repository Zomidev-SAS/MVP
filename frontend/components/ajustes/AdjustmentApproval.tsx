'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  fetchAjustesPendientes,
  aprobarAjuste,
  rechazarAjuste,
} from '@/lib/supabase/ajustes-actions'
import { formatNumber } from '@/lib/format'
import type { AjustePendiente } from '@/lib/types/ajustes'

export function AdjustmentApproval() {
  const [pendientes, setPendientes] = useState<AjustePendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState<number | null>(null)

  useEffect(() => {
    cargar()
  }, [])

  function cargar() {
    setLoading(true)
    fetchAjustesPendientes()
      .then(setPendientes)
      .catch((error) => {
        console.error('Failed to fetch ajustes pendientes:', error)
        setPendientes([])
      })
      .finally(() => setLoading(false))
  }

  async function handleAprobar(id: number) {
    setProcesando(id)
    const resultado = await aprobarAjuste(id)
    setProcesando(null)
    if (resultado.ok) {
      toast.success('Ajuste aprobado.')
      cargar()
    } else {
      toast.error(resultado.error)
    }
  }

  async function handleRechazar(id: number) {
    const motivo = window.prompt('Motivo del rechazo:')
    if (!motivo) return
    setProcesando(id)
    const resultado = await rechazarAjuste(id, motivo)
    setProcesando(null)
    if (resultado.ok) {
      toast.success('Ajuste rechazado.')
      cargar()
    } else {
      toast.error(resultado.error)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Ajustes pendientes de aprobación</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>VIN</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pendientes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                {loading ? 'Cargando...' : 'Sin ajustes pendientes.'}
              </TableCell>
            </TableRow>
          ) : (
            pendientes.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.vin}</TableCell>
                <TableCell className="text-right">{formatNumber(item.cantidad)}</TableCell>
                <TableCell>{item.motivo}</TableCell>
                <TableCell>{new Date(item.created_at).toLocaleDateString('es-CO')}</TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleAprobar(item.id)}
                    disabled={procesando === item.id}
                  >
                    Aprobar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleRechazar(item.id)}
                    disabled={procesando === item.id}
                  >
                    Rechazar
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
