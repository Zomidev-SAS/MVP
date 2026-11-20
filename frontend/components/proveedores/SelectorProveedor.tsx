'use client'

import { useMemo, useState } from 'react'
import { ChevronsUpDown, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { normalizarNit, normalizarTexto } from '@/lib/proveedores/nit'
import { cn } from '@/lib/utils'
import type { ProveedorFila } from '@/lib/types/proveedor'

const MAX_VISIBLES = 50

interface SelectorProveedorProps {
  proveedores: ProveedorFila[]
  /** Id del proveedor elegido, o null si no hay ninguno. */
  valor: number | null
  onSeleccionar: (proveedor: ProveedorFila) => void
  placeholder?: string
  /** Ids que no se pueden elegir (por ejemplo, ya usados en otra fila). */
  excluirIds?: number[]
  disabled?: boolean
  'aria-label'?: string
}

/** Desplegable con todos los proveedores por nombre; se filtra por nombre o por NIT. */
export function SelectorProveedor({
  proveedores,
  valor,
  onSeleccionar,
  placeholder = 'Elegir proveedor',
  excluirIds,
  disabled,
  'aria-label': ariaLabel,
}: SelectorProveedorProps) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const elegido = proveedores.find((p) => p.id === valor) ?? null

  const coincidencias = useMemo(() => {
    const texto = normalizarTexto(busqueda)
    const nit = normalizarNit(busqueda)
    return proveedores.filter((p) => {
      if (!p.activo) return false
      if (excluirIds?.includes(p.id)) return false
      if (!texto) return true
      return (
        normalizarTexto(p.nombre).includes(texto) ||
        (nit !== '' && p.nit_normalizado.includes(nit))
      )
    })
  }, [proveedores, busqueda, excluirIds])

  const visibles = coincidencias.slice(0, MAX_VISIBLES)

  function manejarCambio(siguienteAbierto: boolean) {
    setAbierto(siguienteAbierto)
    if (siguienteAbierto) setBusqueda('')
  }

  function elegir(proveedor: ProveedorFila) {
    onSeleccionar(proveedor)
    setAbierto(false)
  }

  return (
    <Popover open={abierto} onOpenChange={manejarCambio}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm transition-colors outline-none',
          'hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30'
        )}
      >
        <span className={cn('truncate', !elegido && 'text-muted-foreground')}>
          {elegido ? elegido.nombre : placeholder}
        </span>
        <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-(--anchor-width) min-w-72 gap-1.5 p-1.5">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && visibles[0]) {
                e.preventDefault()
                elegir(visibles[0])
              }
            }}
            placeholder="Buscar por nombre o NIT"
            aria-label="Buscar proveedor por nombre o NIT"
            className="pl-8"
          />
        </div>

        <ul className="max-h-64 overflow-y-auto" role="listbox" aria-label="Proveedores">
          {visibles.length === 0 ? (
            <li className="px-2.5 py-3 text-center text-sm text-muted-foreground">
              Sin coincidencias.
            </li>
          ) : (
            visibles.map((proveedor) => (
              <li key={proveedor.id} role="option" aria-selected={proveedor.id === valor}>
                <button
                  type="button"
                  onClick={() => elegir(proveedor)}
                  className={cn(
                    'flex w-full flex-col items-start rounded-md px-2.5 py-1.5 text-left text-sm outline-none transition-colors',
                    'hover:bg-accent focus-visible:bg-accent',
                    proveedor.id === valor && 'bg-accent'
                  )}
                >
                  <span className="w-full truncate font-medium">{proveedor.nombre}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{proveedor.nit}</span>
                </button>
              </li>
            ))
          )}
        </ul>

        {coincidencias.length > visibles.length && (
          <p className="px-2.5 pb-1 text-xs text-muted-foreground">
            Mostrando {visibles.length} de {coincidencias.length}. Escribe para filtrar.
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
