'use client'

import { useState } from 'react'
import { Tv } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { generarTokenPlanta } from '@/lib/supabase/planta-actions'

export function AbrirModoPlantaButton() {
  const [cargando, setCargando] = useState(false)

  async function handleClick() {
    setCargando(true)
    try {
      const token = await generarTokenPlanta()
      window.open(`/planta/${token}`, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('No se pudo generar el enlace de modo planta.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={cargando}>
      <Tv className="h-4 w-4" />
      {cargando ? 'Generando enlace…' : 'Abrir modo planta'}
    </Button>
  )
}
