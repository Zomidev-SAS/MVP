'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { PREVIEW_AUTOMATIZACIONES } from '@/lib/dev/preview-automatizaciones-data'
import type { AutomatizacionEstado } from '@/lib/types/automatizaciones'

export async function fetchAutomatizaciones(): Promise<AutomatizacionEstado[]> {
  if (isDevBypassActive()) return PREVIEW_AUTOMATIZACIONES

  const supabase = await createClient()
  // NOTA: nombre de vista/tabla a confirmar en el contrato de datos (viernes 12:00 m.)
  const { data, error } = await supabase.from('vista_automatizaciones_estado').select('*')
  if (error) throw new Error(`No se pudo cargar el estado de automatizaciones: ${error.message}`)
  return data as AutomatizacionEstado[]
}
