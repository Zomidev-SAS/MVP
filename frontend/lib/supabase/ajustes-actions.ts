'use server'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewAjustesData } from '@/lib/dev/preview-ajustes-data'
import {
  solicitarAjusteSchema,
  type AjustePendiente,
  type AjusteResultado,
  type SolicitarAjusteInput,
} from '@/lib/types/ajustes'

export async function solicitarAjuste(datos: SolicitarAjusteInput): Promise<AjusteResultado> {
  const parsed = solicitarAjusteSchema.safeParse(datos)
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

  const { error } = await supabase.from('ajustes_pendientes').insert({
    movimiento_borrador: {
      vin: parsed.data.vin,
      cantidad: parsed.data.cantidad,
      motivo: parsed.data.motivo,
      evidencia: { descripcion: parsed.data.evidencia ?? '' },
    },
    solicitado_por: user.id,
    estado: 'pendiente',
  })

  if (error) {
    console.error('Failed to insert ajuste_pendiente:', error)
    return { ok: false, error: 'No se pudo enviar la solicitud. Intenta de nuevo.' }
  }

  return { ok: true }
}

export async function fetchAjustesPendientes(): Promise<AjustePendiente[]> {
  if (isDevBypassActive()) {
    return getDevPreviewAjustesData()
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ajustes_pendientes')
    .select('id, movimiento_borrador, solicitado_por, created_at')
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load ajustes_pendientes:', error)
    return []
  }

  return (data ?? []).map((row) => {
    const borrador = row.movimiento_borrador as { vin: string; cantidad: number; motivo: string }
    return {
      id: row.id,
      vin: borrador.vin,
      cantidad: borrador.cantidad,
      motivo: borrador.motivo,
      solicitado_por: row.solicitado_por,
      created_at: row.created_at,
    }
  })
}

export async function fetchAjustesPendientesCount(): Promise<number> {
  if (isDevBypassActive()) {
    return getDevPreviewAjustesData().length
  }

  const supabase = await createClient()

  const { count, error } = await supabase
    .from('ajustes_pendientes')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'pendiente')

  if (error) {
    console.error('Failed to count ajustes_pendientes:', error)
    return 0
  }

  return count ?? 0
}

export async function aprobarAjuste(id: number): Promise<AjusteResultado> {
  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { ok: true }
  }

  const supabase = await createClient()

  const { error } = await supabase.functions.invoke('aprobar-ajuste', {
    body: { ajuste_id: id },
  })

  if (error) {
    console.error('Failed to invoke aprobar-ajuste:', error)
    return { ok: false, error: 'No se pudo aprobar el ajuste. Intenta de nuevo.' }
  }

  return { ok: true }
}

export async function rechazarAjuste(id: number, motivo: string): Promise<AjusteResultado> {
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
    .from('ajustes_pendientes')
    .update({
      estado: 'rechazado',
      motivo_rechazo: motivo,
      resuelto_por: user.id,
      resuelto_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('Failed to reject ajuste:', error)
    return { ok: false, error: 'No se pudo rechazar el ajuste. Intenta de nuevo.' }
  }

  return { ok: true }
}
