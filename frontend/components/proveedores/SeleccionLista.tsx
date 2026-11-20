'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Scale } from 'lucide-react'
import { AvisoMigracion } from '@/components/proveedores/AvisoMigracion'
import { EmptyState } from '@/components/shared/EmptyState'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fechaDeTimestamp, formatearFechaNumerica } from '@/lib/proveedores/fechas'
import { fetchSelecciones } from '@/lib/supabase/proveedor-seleccion-actions'
import { MIGRACION_PENDIENTE } from '@/lib/types/proveedor'
import type { SeleccionResumen } from '@/lib/types/proveedor-seleccion'
import { cn } from '@/lib/utils'

export function SeleccionLista() {
  const router = useRouter()
  const [selecciones, setSelecciones] = useState<SeleccionResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSelecciones()
      .then((resultado) => {
        setSelecciones(resultado.selecciones)
        setError(resultado.error ?? null)
      })
      .catch((fallo) => {
        console.error('Failed to fetch selecciones:', fallo)
        setError('No se pudieron cargar las evaluaciones.')
      })
      .finally(() => setCargando(false))
  }, [])

  const nueva = (
    <Link href="/proveedores/seleccion/nuevo" className={buttonVariants({ variant: 'default' })}>
      Nueva evaluación
    </Link>
  )

  if (error === MIGRACION_PENDIENTE) {
    return <AvisoMigracion migracion="083_proveedor_selecciones.sql" />
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Para proveedores nuevos: compara precio, tiempo de entrega y calidad contra los actuales y deja
          constancia de la decisión.
        </p>
        {nueva}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
        >
          {error}
        </div>
      )}

      {cargando ? (
        <div className="space-y-px overflow-hidden rounded-md border" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse bg-muted/60" />
          ))}
        </div>
      ) : selecciones.length === 0 ? (
        <div className="rounded-md border">
          <EmptyState
            icon={Scale}
            title="Todavía no hay evaluaciones de selección"
            description="Crea una cuando llegue un proveedor nuevo para compararlo con el actual."
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Evaluación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Proveedor elegido</TableHead>
                <TableHead className="text-right">Comparados</TableHead>
                <TableHead>Actualizada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selecciones.map((s) => (
                <TableRow
                  key={s.id}
                  onClick={() => router.push(`/proveedores/seleccion/${s.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell className="whitespace-normal">
                    <Link
                      href={`/proveedores/seleccion/${s.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {s.titulo}
                    </Link>
                    {s.creado_por_nombre && (
                      <span className="block text-xs text-muted-foreground">{s.creado_por_nombre}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-block whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold',
                        s.estado === 'decidida' ? 'badge-success' : 'chip-neutral'
                      )}
                    >
                      {s.estado === 'decidida' ? 'Decidida' : 'Borrador'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {s.nombre_elegido ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.total_candidatos}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatearFechaNumerica(fechaDeTimestamp(s.updated_at)) ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
