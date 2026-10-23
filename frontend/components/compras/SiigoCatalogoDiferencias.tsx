'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  aplicarDiferenciaSiigo,
  aplicarDiferenciasSiigo,
  marcarDiferenciaSiigoRevisada,
  marcarDiferenciasSiigoRevisadas,
} from '@/lib/supabase/siigo-catalogo-actions'
import { formatFechaHora } from '@/lib/format'
import type { SiigoCatalogoDiferencia, SiigoCatalogoEstado } from '@/lib/types/siigo'

interface Grupo {
  clave: string
  tipo: 'producto' | 'proveedor'
  campo: string
  titulo: string
  ayuda: string
  botonAplicar: string
  confirmar: string
}

// Cada grupo lleva lo de Siigo al panel de una forma distinta.
const GRUPOS: Grupo[] = [
  {
    clave: 'producto-existencia',
    tipo: 'producto',
    campo: 'existencia',
    titulo: 'Productos que están en Siigo y no en el panel',
    ayuda: 'Agregarlos crea el producto en el catálogo del panel con su código y nombre de Siigo.',
    botonAplicar: 'Agregar al panel',
    confirmar: 'Se agregarán al catálogo del panel todos estos productos de Siigo. ¿Continuar?',
  },
  {
    clave: 'producto-nombre',
    tipo: 'producto',
    campo: 'nombre',
    titulo: 'Productos con el nombre distinto',
    ayuda: 'Corregir deja en el panel el nombre que tiene Siigo.',
    botonAplicar: 'Usar nombre de Siigo',
    confirmar: 'Se cambiará en el panel el nombre de todos estos productos por el de Siigo. ¿Continuar?',
  },
  {
    clave: 'proveedor-nombre',
    tipo: 'proveedor',
    campo: 'nombre',
    titulo: 'Proveedores con el nombre distinto',
    ayuda: 'Corregir deja el nombre de Siigo en las órdenes de compra de ese proveedor.',
    botonAplicar: 'Usar nombre de Siigo',
    confirmar: 'Se cambiará el nombre de estos proveedores en las órdenes de compra por el de Siigo. ¿Continuar?',
  },
]

const POR_PAGINA = 15

function GrupoDiferencias({
  grupo,
  filas,
  ocupado,
  onAplicar,
  onIgnorar,
  onAplicarTodas,
  onIgnorarTodas,
}: {
  grupo: Grupo
  filas: SiigoCatalogoDiferencia[]
  ocupado: boolean
  onAplicar: (id: number) => void
  onIgnorar: (id: number) => void
  onAplicarTodas: (g: Grupo) => void
  onIgnorarTodas: (g: Grupo) => void
}) {
  const [visibles, setVisibles] = useState(POR_PAGINA)
  if (filas.length === 0) return null

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">
            {grupo.titulo} <Badge variant="secondary">{filas.length}</Badge>
          </h3>
          <p className="text-xs text-muted-foreground">{grupo.ayuda}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" disabled={ocupado} onClick={() => onAplicarTodas(grupo)}>
            {grupo.botonAplicar} (todas)
          </Button>
          <Button size="sm" variant="outline" disabled={ocupado} onClick={() => onIgnorarTodas(grupo)}>
            Ignorar todas
          </Button>
        </div>
      </div>

      <ul className="space-y-1">
        {filas.slice(0, visibles).map((d) => (
          <li
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1 basis-60">
              <span className="font-mono text-xs text-muted-foreground">{d.codigo}</span>
              {grupo.campo === 'existencia' ? (
                <p className="break-words">{d.valorSiigo ?? '—'}</p>
              ) : (
                <p className="break-words">
                  <span className="text-muted-foreground">Panel:</span> {d.valorPanel ?? '—'}{' '}
                  <span className="text-muted-foreground">→ Siigo:</span> {d.valorSiigo ?? '—'}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" disabled={ocupado} onClick={() => onAplicar(d.id)}>
                {grupo.botonAplicar}
              </Button>
              <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => onIgnorar(d.id)}>
                Ignorar
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {filas.length > visibles && (
        <Button variant="link" size="sm" onClick={() => setVisibles((v) => v + POR_PAGINA * 4)}>
          Ver más ({filas.length - visibles} restantes)
        </Button>
      )}
    </section>
  )
}

export function SiigoCatalogoDiferencias({ estado }: { estado: SiigoCatalogoEstado }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function ejecutar(accion: () => Promise<{ ok: true; mensaje: string } | { ok: false; error: string }>) {
    startTransition(async () => {
      const res = await accion()
      if (res.ok) {
        toast.success(res.mensaje)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  function aplicar(id: number) {
    ejecutar(async () => {
      const r = await aplicarDiferenciaSiigo(id)
      return r.ok ? { ok: true, mensaje: 'Dato de Siigo aplicado en el panel.' } : r
    })
  }

  function ignorar(id: number) {
    ejecutar(async () => {
      const r = await marcarDiferenciaSiigoRevisada(id)
      return r.ok ? { ok: true, mensaje: 'Diferencia ignorada.' } : r
    })
  }

  function aplicarTodas(g: Grupo) {
    if (!window.confirm(g.confirmar)) return
    ejecutar(async () => {
      const r = await aplicarDiferenciasSiigo(g.tipo, g.campo)
      if (!r.ok) return r
      const extra = r.omitidas > 0 ? ` (${r.omitidas} sin datos de Siigo, se dejaron pendientes)` : ''
      return { ok: true, mensaje: `${r.aplicadas} aplicadas en el panel.${extra}` }
    })
  }

  function ignorarTodas(g: Grupo) {
    if (!window.confirm('Se marcarán como revisadas, sin cambiar nada en el panel. ¿Continuar?')) return
    ejecutar(async () => {
      const r = await marcarDiferenciasSiigoRevisadas(g.tipo, g.campo)
      return r.ok ? { ok: true, mensaje: `${r.revisadas} diferencias ignoradas.` } : r
    })
  }

  const sync = estado.ultimaSincronizacion
  const porGrupo = (g: Grupo) =>
    estado.diferencias.filter((d) => d.tipo === g.tipo && d.campo === g.campo)
  const conocidas = new Set(GRUPOS.map((g) => `${g.tipo}|${g.campo}`))
  const otras = estado.diferencias.filter((d) => !conocidas.has(`${d.tipo}|${d.campo}`))

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Novedades de Siigo para validar ({estado.diferencias.length})
        </CardTitle>
        {sync && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {sync.resultado === 'error' ? (
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            )}
            <Clock className="h-3 w-3" />
            Última bajada: {sync.fecha ? formatFechaHora(sync.fecha) : 'nunca'}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {estado.diferencias.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Todo al día: Siigo y el panel coinciden.
          </p>
        ) : (
          <>
            {GRUPOS.map((g) => (
              <GrupoDiferencias
                key={g.clave}
                grupo={g}
                filas={porGrupo(g)}
                ocupado={isPending}
                onAplicar={aplicar}
                onIgnorar={ignorar}
                onAplicarTodas={aplicarTodas}
                onIgnorarTodas={ignorarTodas}
              />
            ))}
            {otras.length > 0 && (
              <ul className="space-y-1">
                {otras.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                    <span>
                      {d.tipo} <span className="font-mono text-xs">{d.codigo}</span> · {d.campo}: {d.valorPanel ?? '—'} →{' '}
                      {d.valorSiigo ?? '—'}
                    </span>
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => ignorar(d.id)}>
                      Marcar revisado
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
