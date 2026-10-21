'use client'

import { useState } from 'react'
import { Tv } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { generarTokenPlanta, generarTokenPlantaCompras } from '@/lib/supabase/planta-actions'

export function AbrirModoPlantaButton({ tipo = 'general' }: { tipo?: 'general' | 'compras' }) {
  const [cargando, setCargando] = useState(false)

  async function handleClick() {
    setCargando(true)
    try {
      if (tipo === 'compras') {
        const token = await generarTokenPlantaCompras()
        window.open(`/planta/compras/${token}`, '_blank', 'noopener,noreferrer')
      } else {
        const token = await generarTokenPlanta()
        window.open(`/planta/${token}`, '_blank', 'noopener,noreferrer')
      }
    } catch {
      toast.error('No se pudo generar el enlace de modo planta.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={cargando}>
      <Tv className="h-4 w-4" />
      {cargando ? 'Generando enlace…' : tipo === 'compras' ? 'Abrir modo planta (compras)' : 'Abrir modo planta'}
    </Button>
  )
}
