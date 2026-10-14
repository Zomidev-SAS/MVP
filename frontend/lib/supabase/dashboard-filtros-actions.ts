'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'

export interface OpcionFiltro {
  id: string
  nombre: string
}

const PREVIEW_BODEGAS: OpcionFiltro[] = [
  { id: 'Principal', nombre: 'Principal' },
  { id: 'Taller', nombre: 'Taller' },
  { id: 'Instalación', nombre: 'Instalación' },
]

const PREVIEW_CATEGORIAS: OpcionFiltro[] = [
  { id: 'Carrocería', nombre: 'Carrocería' },
  { id: 'Mecánica', nombre: 'Mecánica' },
  { id: 'Accesorios', nombre: 'Accesorios' },
]

export async function fetchOpcionesFiltrosDashboard(): Promise<{
  bodegas: OpcionFiltro[]
  categorias: OpcionFiltro[]
}> {
  if (isDevBypassActive()) {
    return { bodegas: PREVIEW_BODEGAS, categorias: PREVIEW_CATEGORIAS }
  }

  const supabase = await createClient()
  const [bodegasResult, categoriasResult] = await Promise.all([
    supabase.from('bodegas').select('nombre').order('nombre'),
    supabase.from('categorias_inventario').select('nombre').order('nombre'),
  ])

  if (bodegasResult.error) {
    console.error('Failed to load bodegas:', bodegasResult.error)
  }
  if (categoriasResult.error) {
    console.error('Failed to load categorias_inventario:', categoriasResult.error)
  }

  return {
    bodegas: (bodegasResult.data ?? []).map((b: { nombre: string }) => ({
      id: b.nombre,
      nombre: b.nombre,
    })),
    categorias: (categoriasResult.data ?? []).map((c: { nombre: string }) => ({
      id: c.nombre,
      nombre: c.nombre,
    })),
  }
}
