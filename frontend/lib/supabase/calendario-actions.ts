'use server'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewCalendarioData } from '@/lib/dev/preview-calendario-data'
import {
  crearEventoSchema,
  type CalendarEvento,
  type CrearEventoInput,
  type EventoResultado,
} from '@/lib/types/calendario'

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
    .select('id, fecha, titulo, nota')
    .eq('usuario_id', user.id)
    .order('fecha', { ascending: true })

  if (error) {
    console.error('Failed to load eventos_calendario:', error)
    return []
  }

  return data ?? []
}

export async function crearEvento(datos: CrearEventoInput): Promise<EventoResultado> {
  const parsed = crearEventoSchema.safeParse(datos)
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

  const { error } = await supabase.from('eventos_calendario').insert({
    usuario_id: user.id,
    fecha: parsed.data.fecha,
    titulo: parsed.data.titulo,
    nota: parsed.data.nota ?? null,
  })

  if (error) {
    console.error('Failed to insert evento_calendario:', error)
    return { ok: false, error: 'No se pudo guardar el evento. Intenta de nuevo.' }
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
