'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  marcarOcListoConSiigo,
  reintentarEnvioSiigo,
} from '@/lib/supabase/ordenes-compra-actions'
import {
  ETIQUETA_MEDIO_PAGO,
  MEDIOS_PAGO_OC,
  tituloOrdenDisplay,
  type MedioPagoOC,
  type OrdenCompra,
} from '@/lib/types/orden-compra'

export type ModoFacturaProveedor = 'listo' | 'reintento'

interface FacturaProveedorDialogProps {
  orden: OrdenCompra | null
  modo: ModoFacturaProveedor
  onOpenChange: (abierto: boolean) => void
  onEnviada: () => void
}

/**
 * Siigo exige el número de la factura del proveedor para crear la factura de
 * compra: se pide al marcar la orden como lista (cuando llega esa factura) y al
 * reintentar un envío que falló por no tenerla.
 */
export function FacturaProveedorDialog({ orden, modo, onOpenChange, onEnviada }: FacturaProveedorDialogProps) {
  return (
    <Dialog open={orden !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* key: el formulario arranca con los datos de la orden elegida */}
        {orden && (
          <FormularioFactura
            key={`${orden.id}-${modo}`}
            orden={orden}
            modo={modo}
            onOpenChange={onOpenChange}
            onEnviada={onEnviada}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FormularioFactura({
  orden,
  modo,
  onOpenChange,
  onEnviada,
}: {
  orden: OrdenCompra
  modo: ModoFacturaProveedor
  onOpenChange: (abierto: boolean) => void
  onEnviada: () => void
}) {
  const [medioPago, setMedioPago] = useState<MedioPagoOC | ''>(orden.medio_pago ?? '')
  const [prefijo, setPrefijo] = useState(orden.factura_proveedor_prefijo ?? '')
  const [numero, setNumero] = useState(orden.factura_proveedor_numero ?? '')
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    if (!numero.trim()) {
      toast.error('Indica el número de la factura del proveedor.')
      return
    }
    setEnviando(true)
    try {
      const factura = { prefijo, numero }
      const res =
        modo === 'listo'
          ? await marcarOcListoConSiigo(orden.id, medioPago || null, factura)
          : await reintentarEnvioSiigo(orden.id, factura)
      if (res.ok) {
        toast.success('Enviando la factura de compra a Siigo…')
        onOpenChange(false)
        onEnviada()
      } else {
        toast.error(res.error)
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{modo === 'listo' ? 'Marcar como lista' : 'Reintentar envío a Siigo'}</DialogTitle>
        <DialogDescription>
          {tituloOrdenDisplay(orden)} — Siigo necesita los datos de la factura que emitió el proveedor para
          crear la factura de compra.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="factura-prefijo">Prefijo</label>
            <Input
              id="factura-prefijo"
              value={prefijo}
              onChange={(e) => setPrefijo(e.target.value)}
              placeholder="Ej. FE"
              autoComplete="off"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-sm font-medium" htmlFor="factura-numero">Número de factura *</label>
            <Input
              id="factura-numero"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ej. 1234"
              autoComplete="off"
              autoFocus
            />
          </div>
        </div>

        {modo === 'listo' && (
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="factura-medio-pago">Medio de pago</label>
            <select
              id="factura-medio-pago"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value as MedioPagoOC | '')}
            >
              <option value="">Sin especificar</option>
              {MEDIOS_PAGO_OC.map((m) => (
                <option key={m} value={m}>{ETIQUETA_MEDIO_PAGO[m]}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" onClick={enviar} disabled={enviando}>
          {enviando ? 'Enviando…' : modo === 'listo' ? 'Marcar lista y enviar a Siigo' : 'Reintentar envío'}
        </Button>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
      </div>
    </>
  )
}
