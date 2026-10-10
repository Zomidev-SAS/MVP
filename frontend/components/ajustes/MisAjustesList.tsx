'use client'

import { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchMisAjustes } from '@/lib/supabase/ajustes-actions'
import { formatNumber } from '@/lib/format'
import type { AjusteMio } from '@/lib/types/ajustes'

const ESTADO_LABELS: Record<AjusteMio['estado'], string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
}

const ESTADO_CLASSES: Record<AjusteMio['estado'], string> = {
  pendiente: 'text-amber-600',
  aprobado: 'text-green-600',
  rechazado: 'text-red-500',
}

export function MisAjustesList() {
  const [ajustes, setAjustes] = useState<AjusteMio[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMisAjustes()
      .then(setAjustes)
      .catch((error) => {
        console.error('Failed to fetch mis ajustes:', error)
        setAjustes([])
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Mis solicitudes</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código producto</TableHead>
            <TableHead>Bodega</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ajustes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                {loading ? 'Cargando...' : 'No has solicitado ajustes.'}
              </TableCell>
            </TableRow>
          ) : (
            ajustes.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.codigo_producto}</TableCell>
                <TableCell>{a.bodega}</TableCell>
                <TableCell className="text-right">{formatNumber(a.cantidad)}</TableCell>
                <TableCell>{a.motivo}</TableCell>
                <TableCell>
                  <span className={ESTADO_CLASSES[a.estado]}>{ESTADO_LABELS[a.estado]}</span>
                  {a.estado === 'rechazado' && a.motivo_rechazo && (
                    <p className="text-xs text-muted-foreground">{a.motivo_rechazo}</p>
                  )}
                </TableCell>
                <TableCell>{new Date(a.created_at).toLocaleDateString('es-CO')}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
