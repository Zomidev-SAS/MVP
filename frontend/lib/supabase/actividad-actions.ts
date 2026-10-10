'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { PREVIEW_ACTIVIDAD } from '@/lib/dev/preview-actividad-data'
import type { EventoActividad } from '@/lib/types/actividad'

export async function fetchActividad(filtros?: { bodega?: string; accion?: string }): Promise<EventoActividad[]> {
  if (isDevBypassActive()) {
    return PREVIEW_ACTIVIDAD.filter(
      (e) => (!filtros?.bodega || e.bodega === filtros.bodega) && (!filtros?.accion || e.accion === filtros.accion)
    )
  }
  const supabase = await createClient()
  // NOTA: nombre de vista/tabla a confirmar en el contrato de datos (viernes 12:00 m.)
  let query = supabase.from('vista_actividad_auditoria').select('*').order('creado_en', { ascending: false }).limit(200)
  if (filtros?.bodega) query = query.eq('bodega', filtros.bodega)
  if (filtros?.accion) query = query.eq('accion', filtros.accion)
  const { data, error } = await query
  if (error) throw new Error(`No se pudo cargar actividad: ${error.message}`)
  return data as EventoActividad[]
}
