'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  asignarCodigoLineaOC,
  buscarProductosOC,
  registrarRecepcionItem,
} from '@/lib/supabase/ordenes-compra-actions'
import { CampoSugerencias } from '@/components/compras/CampoSugerencias'
import {
  resumenRecepcion,
  type OrdenCompra,
  type OrdenCompraItem,
  type ProductoSugerido,
} from '@/lib/types/orden-compra'

function formatearNumero(n: number): string {
  return n.toLocaleString('es-CO', { maximumFractionDigits: 2 })
}

function formatearActualizacion(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface RecepcionLineaProps {
  orden: OrdenCompra
  item: OrdenCompraItem
  mostrarCodigo: boolean
  puedeAsignarCodigo: boolean
  onActualizado: () => void
}

function RecepcionLinea({ orden, item, mostrarCodigo, puedeAsignarCodigo, onActualizado }: RecepcionLineaProps) {
  const [llegaron, setLlegaron] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [asignando, setAsignando] = useState(false)
  const [busquedaCodigo, setBusquedaCodigo] = useState('')
  const sinCodigo = item.codigo_producto === 'SIN-CODIGO'
  const resumen = resumenRecepcion(item)
  const actualizado = formatearActualizacion(item.cantidad_recibida_at)
  const editable = orden.estado === 'en_curso' && !resumen.completa

  async function asignarCodigo(producto: ProductoSugerido) {
    const res = await asignarCodigoLineaOC(orden.id, item.id, producto.codigo_producto)
    if (res.ok) {
      toast.success(`Código ${producto.codigo_producto} asignado.`)
      setAsignando(false)
      setBusquedaCodigo('')
      onActualizado()
    } else {
      toast.error(res.error)
    }
  }

  async function registrar() {
    const n = Number(llegaron)
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Indica cuántas unidades llegaron.')
      return
    }
    setGuardando(true)
    try {
      const res = await registrarRecepcionItem(orden.id, item.id, n)
      if (res.ok) {
        toast.success('Recepción registrada.')
        setLlegaron('')
        onActualizado()
      } else {
        toast.error(res.error)
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-1 rounded-md border bg-muted/30 p-2 text-xs">
      <p className="font-medium text-foreground">
        {item.descripcion}
        {mostrarCodigo && (
          <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">
            {item.codigo_producto}
          </span>
        )}
        {sinCodigo && (
          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
            Sin código
          </span>
        )}
      </p>
      {sinCodigo && puedeAsignarCodigo && (
        <div className="pt-1">
          {asignando ? (
            <div className="max-w-sm space-y-1">
              <CampoSugerencias<ProductoSugerido>
                value={busquedaCodigo}
                onChange={setBusquedaCodigo}
                buscar={buscarProductosOC}
                onSeleccionar={asignarCodigo}
                claveItem={(p) => p.codigo_producto}
                renderItem={(p) => (
                  <span>
                    <span className="font-medium">{p.nombre_producto}</span>
                    <span className="text-muted-foreground"> — {p.codigo_producto}</span>
                  </span>
                )}
                placeholder="Busca el producto por nombre o código"
              />
              <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setAsignando(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => setAsignando(true)}>
              Asignar código
            </Button>
          )}
        </div>
      )}
      <p className="text-muted-foreground">
        Pedidas {formatearNumero(resumen.pedida)} · Recibidas {formatearNumero(resumen.recibida)} ·{' '}
        <span className={resumen.completa ? 'font-semibold text-emerald-700' : 'font-semibold text-foreground'}>
          {resumen.completa ? 'Completa' : `Restan ${formatearNumero(resumen.restante)}`}
        </span>
      </p>
      {actualizado && <p className="text-muted-foreground">Actualizado {actualizado}</p>}
      {item.observaciones?.trim() && (
        <p className="text-foreground">Nota: {item.observaciones.trim()}</p>
      )}
      {editable && (
        <div className="flex items-center gap-1 pt-1">
          <Input
            type="number"
            min={0}
            step="any"
            value={llegaron}
            onChange={(e) => setLlegaron(e.target.value)}
            placeholder="Llegaron…"
            className="h-7 w-24 text-xs"
          />
          <Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={guardando} onClick={registrar}>
            {guardando ? '…' : 'Registrar'}
          </Button>
        </div>
      )}
    </div>
  )
}

interface RecepcionLineasProps {
  orden: OrdenCompra
  onActualizado: () => void
  /** Compras y supervisor pueden asignar el código a las líneas SIN-CODIGO. */
  puedeAsignarCodigo?: boolean
}

/** Entregas parciales por número, con la nota de cada línea visible en la tabla. */
export function RecepcionLineas({ orden, onActualizado, puedeAsignarCodigo = false }: RecepcionLineasProps) {
  if (orden.items.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <div className="space-y-2">
      {orden.items.map((item) => (
        <RecepcionLinea
          key={item.id}
          orden={orden}
          item={item}
          mostrarCodigo
          puedeAsignarCodigo={puedeAsignarCodigo && orden.estado === 'en_curso'}
          onActualizado={onActualizado}
        />
      ))}
    </div>
  )
}
