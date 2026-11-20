'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { PREVIEW_ACTIVIDAD } from '@/lib/dev/preview-actividad-data'
import type { EventoActividad } from '@/lib/types/actividad'

// eventos_sistema (docs/CONTRATO_DATOS_SECCION2.md, sección 3) no trae un
// texto humano de "acción" ni el nombre del actor — solo `tipo` (código) y
// `actor` (uuid). Se traducen aquí, igual que fn_registrar_evento_sistema
// (migración 031) genera cada `tipo`.
const ACCION_POR_TIPO: Record<string, string> = {
  movimiento_entrada: 'registró una entrada de inventario',
  movimiento_salida_vin: 'registró una salida por VIN',
  movimiento_ajuste: 'registró un ajuste de inventario',
  movimiento_reverso: 'registró un reverso de movimiento',
  ajuste_creado: 'creó un ajuste',
  ajuste_resuelto: 'resolvió un ajuste',
  oc_creada: 'creó una orden de compra',
  oc_actualizada: 'actualizó una orden de compra',
  formulario_recibido: 'envió un formulario desde la app',
  perfil_creado: 'creó un usuario',
  perfil_actualizado: 'actualizó un usuario',
}

function accionLegible(tipo: string): string {
  return ACCION_POR_TIPO[tipo] ?? tipo.replaceAll('_', ' ')
}

interface FilaEventoSistema {
  id: number
  tipo: string
  entidad: string
  entidad_id: string
  actor: string | null
  bodega: string | null
  fecha: string
}

export async function fetchActividad(filtros?: { bodega?: string; accion?: string }): Promise<EventoActividad[]> {
  if (isDevBypassActive()) {
    return PREVIEW_ACTIVIDAD.filter(
      (e) => (!filtros?.bodega || e.bodega === filtros.bodega) && (!filtros?.accion || e.accion === filtros.accion)
    )
  }

  const supabase = await createClient()
  let query = supabase
    .from('eventos_sistema')
    .select('id, tipo, entidad, entidad_id, actor, bodega, fecha')
    .order('fecha', { ascending: false })
    .limit(200)
  if (filtros?.bodega) query = query.eq('bodega', filtros.bodega)
  if (filtros?.accion) query = query.eq('tipo', filtros.accion)

  const { data, error } = await query
  if (error) throw new Error(`No se pudo cargar actividad: ${error.message}`)

  const eventos = (data ?? []) as FilaEventoSistema[]
  const actorIds = Array.from(new Set(eventos.map((e) => e.actor).filter((id): id is string => id !== null)))

  const nombresPorId = new Map<string, string>()
  if (actorIds.length > 0) {
    const { data: perfiles } = await supabase.from('profiles').select('id, nombre').in('id', actorIds)
    for (const p of perfiles ?? []) nombresPorId.set(p.id, p.nombre)
  }

  return eventos.map((e) => ({
    id: String(e.id),
    actorNombre: (e.actor && nombresPorId.get(e.actor)) ?? 'Sistema',
    accion: accionLegible(e.tipo),
    recurso: e.entidad,
    recursoId: e.entidad_id,
    bodega: e.bodega,
    creadoEn: e.fecha,
  }))
}
