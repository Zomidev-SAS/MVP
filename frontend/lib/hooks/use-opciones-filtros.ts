'use client'

import { useEffect, useState } from 'react'
import { fetchOpcionesFiltrosDashboard, type OpcionFiltro } from '@/lib/supabase/dashboard-filtros-actions'

export function useOpcionesFiltros(): { bodegas: OpcionFiltro[]; categorias: OpcionFiltro[] } {
  const [opciones, setOpciones] = useState<{ bodegas: OpcionFiltro[]; categorias: OpcionFiltro[] }>({
    bodegas: [],
    categorias: [],
  })

  useEffect(() => {
    let activo = true
    fetchOpcionesFiltrosDashboard().then((resultado) => {
      if (activo) setOpciones(resultado)
    })
    return () => {
      activo = false
    }
  }, [])

  return opciones
}
