'use client'

import { useState } from 'react'
import { CheckCircle2, FileText, PenLine } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  firmarOrdenCompraDocumento,
  urlDocumentoOrdenCompra,
} from '@/lib/supabase/ordenes-compra-documento-actions'
import type { OrdenCompra } from '@/lib/types/orden-compra'

function formatearFirma(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

interface DocumentoOcProps {
  orden: OrdenCompra
  puedeFirmar: boolean
  onActualizado: () => void
}

/** Documento de Siigo de la OC: ver el original o el firmado, y firmarlo (administrador). */
export function DocumentoOc({ orden, puedeFirmar, onActualizado }: DocumentoOcProps) {
  const [firmando, setFirmando] = useState(false)
  const firmada = Boolean(orden.firmada_at)

  async function abrir(version: 'original' | 'firmado') {
    // Se abre la pestaña antes de la espera para que el navegador no bloquee la ventana.
    const ventana = window.open('', '_blank')
    const res = await urlDocumentoOrdenCompra(orden.id, version)
    if (res.ok && ventana) {
      ventana.location.href = res.url
    } else {
      ventana?.close()
      toast.error(res.ok ? 'No se pudo abrir la pestaña.' : res.error)
    }
  }

  async function firmar() {
    setFirmando(true)
    try {
      const res = await firmarOrdenCompraDocumento(orden.id)
      if (res.ok) {
        toast.success('Orden firmada. Se avisó a compras y al firmante.')
        onActualizado()
      } else {
        toast.error(res.error)
      }
    } finally {
      setFirmando(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        <Button type="button" variant="outline" size="sm" onClick={() => abrir(firmada ? 'firmado' : 'original')}>
          <FileText className="mr-1 h-3 w-3 text-red-600" />
          {firmada ? 'Ver firmada' : 'Ver documento'}
        </Button>
        {firmada && (
          <Button type="button" variant="ghost" size="sm" onClick={() => abrir('original')}>
            Original
          </Button>
        )}
        {!firmada && puedeFirmar && (
          <Button type="button" size="sm" disabled={firmando} onClick={firmar}>
            <PenLine className="mr-1 h-3 w-3" />
            {firmando ? 'Firmando…' : 'Firmar'}
          </Button>
        )}
      </div>
      {firmada ? (
        <p className="flex items-center gap-1 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Firmada {orden.firmada_at ? formatearFirma(orden.firmada_at) : ''}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Pendiente de firma</p>
      )}
    </div>
  )
}
