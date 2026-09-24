'use server'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewCalendarioData } from '@/lib/dev/preview-calendario-data'
import {
  guardarEventoSchema,
  eventoOcurreEnFecha,
  type CalendarEvento,
  type GuardarEventoInput,
  type EventoResultado,
} from '@/lib/types/calendario'

type EventoRow = {
  id: number
  fecha: string
  fecha_fin: string | null
  titulo: string
  nota: string | null
  evento_secciones: { id: number; titulo: string; completada: boolean; orden: number }[] | null
  evento_fechas: { fecha: string }[] | null
}

function mapEvento(row: EventoRow): CalendarEvento {
  return {
    id: row.id,
    fecha: row.fecha,
    fecha_fin: row.fecha_fin,
    titulo: row.titulo,
    nota: row.nota,
    secciones: (row.evento_secciones ?? []).sort((a, b) => a.orden - b.orden),
    fechas_adicionales: (row.evento_fechas ?? []).map((f) => f.fecha).sort(),
  }
}

const EVENTO_SELECT = `
  id, fecha, fecha_fin, titulo, nota,
  evento_secciones (id, titulo, completada, orden),
  evento_fechas (fecha)
`

export async function fetchEventos(): Promise<CalendarEvento[]> {
  if (isDevBypassActive()) {
    return getDevPreviewCalendarioData()
  }

  const user = await getSessionUser()
  if (!user) {
    return []
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('eventos_calendario')
    .select(EVENTO_SELECT)
    .eq('usuario_id', user.id)
    .order('fecha', { ascending: true })

  if (error) {
    console.error('Failed to load eventos_calendario:', error)
    return []
  }

  return (data ?? []).map((row) => mapEvento(row as EventoRow))
}

export async function fetchEventosEnFecha(fecha: string): Promise<CalendarEvento[]> {
  const eventos = await fetchEventos()
  return eventos.filter((e) => eventoOcurreEnFecha(e, fecha))
}

export async function fetchEventosHoy(): Promise<CalendarEvento[]> {
  const hoy = new Date()
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  return fetchEventosEnFecha(fecha)
}

async function guardarRelaciones(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventoId: number,
  datos: GuardarEventoInput
) {
  const { error: delSec } = await supabase.from('evento_secciones').delete().eq('evento_id', eventoId)
  if (delSec) throw delSec

  const { error: delFechas } = await supabase.from('evento_fechas').delete().eq('evento_id', eventoId)
  if (delFechas) throw delFechas

  const secciones = datos.secciones ?? []
  if (secciones.length > 0) {
    const { error } = await supabase.from('evento_secciones').insert(
      secciones.map((s, i) => ({
        evento_id: eventoId,
        titulo: s.titulo,
        completada: s.completada,
        orden: i,
      }))
    )
    if (error) throw error
  }

  const extras = (datos.fechas_adicionales ?? []).filter((f) => f !== datos.fecha)
  if (extras.length > 0) {
    const { error } = await supabase.from('evento_fechas').insert(
      extras.map((fecha) => ({ evento_id: eventoId, fecha }))
    )
    if (error) throw error
  }
}

export async function crearEvento(datos: GuardarEventoInput): Promise<EventoResultado> {
  const parsed = guardarEventoSchema.safeParse(datos)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos. Revisa el formulario.' }
  }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) {
    return { ok: false, error: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('eventos_calendario')
    .insert({
      usuario_id: user.id,
      fecha: parsed.data.fecha,
      fecha_fin: parsed.data.fecha_fin || null,
      titulo: parsed.data.titulo,
      nota: parsed.data.nota.trim() || null,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('Failed to insert evento_calendario:', error)
    return { ok: false, error: 'No se pudo guardar el evento. Intenta de nuevo.' }
  }

  try {
    await guardarRelaciones(supabase, data.id, parsed.data)
  } catch (relError) {
    console.error('Failed to save evento relations:', relError)
    await supabase.from('eventos_calendario').delete().eq('id', data.id)
    return { ok: false, error: 'No se pudieron guardar las secciones o fechas del evento.' }
  }

  return { ok: true }
}

export async function actualizarEvento(
  id: number,
  datos: GuardarEventoInput
): Promise<EventoResultado> {
  const parsed = guardarEventoSchema.safeParse(datos)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos. Revisa el formulario.' }
  }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) {
    return { ok: false, error: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('eventos_calendario')
    .update({
      fecha: parsed.data.fecha,
      fecha_fin: parsed.data.fecha_fin || null,
      titulo: parsed.data.titulo,
      nota: parsed.data.nota.trim() || null,
    })
    .eq('id', id)
    .eq('usuario_id', user.id)

  if (error) {
    console.error('Failed to update evento_calendario:', error)
    return { ok: false, error: 'No se pudo actualizar el evento. Intenta de nuevo.' }
  }

  try {
    await guardarRelaciones(supabase, id, parsed.data)
  } catch (relError) {
    console.error('Failed to update evento relations:', relError)
    return { ok: false, error: 'No se pudieron actualizar las secciones o fechas del evento.' }
  }

  return { ok: true }
}

export async function eliminarEvento(id: number): Promise<EventoResultado> {
  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) {
    return { ok: false, error: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('eventos_calendario')
    .delete()
    .eq('id', id)
    .eq('usuario_id', user.id)

  if (error) {
    console.error('Failed to delete evento_calendario:', error)
    return { ok: false, error: 'No se pudo borrar el evento. Intenta de nuevo.' }
  }

  return { ok: true }
}
