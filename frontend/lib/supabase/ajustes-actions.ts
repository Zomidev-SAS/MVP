'use server'

import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getDevPreviewAjustesData } from '@/lib/dev/preview-ajustes-data'
import {
  solicitarAjusteSchema,
  type AjusteMio,
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

  const auth = await requireRole(ROUTE_PERMISSIONS.ajustes)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('ajustes_pendientes').insert({
    movimiento_borrador: {
      codigo_producto: parsed.data.codigo_producto,
      cantidad: parsed.data.cantidad,
      bodega: parsed.data.bodega,
      valor_unitario: parsed.data.valor_unitario ?? null,
      motivo: parsed.data.motivo,
    },
    solicitado_por: auth.user.id,
    estado: 'pendiente',
  })

  if (error) {
    console.error('Failed to insert ajuste_pendiente:', error)
    return { ok: false, error: 'No se pudo enviar la solicitud. Intenta de nuevo.' }
  }

  return { ok: true }
}

type MovimientoBorrador = {
  codigo_producto: string
  cantidad: number
  bodega: string
  motivo: string
}

export async function fetchAjustesPendientes(): Promise<AjustePendiente[]> {
  if (isDevBypassActive()) {
    return getDevPreviewAjustesData()
  }

  const auth = await requireRole(['supervisor'])
  if (!auth.ok) return []

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
    const borrador = row.movimiento_borrador as MovimientoBorrador
    return {
      id: row.id,
      codigo_producto: borrador.codigo_producto,
      cantidad: borrador.cantidad,
      bodega: borrador.bodega,
      motivo: borrador.motivo,
      solicitado_por: row.solicitado_por,
      created_at: row.created_at,
    }
  })
}

export async function fetchMisAjustes(): Promise<AjusteMio[]> {
  if (isDevBypassActive()) {
    return getDevPreviewAjustesData().map((a, i) => ({
      id: a.id,
      codigo_producto: a.codigo_producto,
      cantidad: a.cantidad,
      bodega: a.bodega,
      motivo: a.motivo,
      estado: i % 3 === 0 ? 'aprobado' : i % 3 === 1 ? 'rechazado' : 'pendiente',
      motivo_rechazo: i % 3 === 1 ? 'El código de producto no coincide con el inventario físico.' : null,
      created_at: a.created_at,
      resuelto_at: i % 3 === 0 ? a.created_at : null,
    }))
  }

  const user = await getSessionUser()
  if (!user) return []

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ajustes_pendientes')
    .select('id, movimiento_borrador, estado, motivo_rechazo, created_at, resuelto_at')
    .eq('solicitado_por', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load mis ajustes:', error)
    return []
  }

  return (data ?? []).map((row) => {
    const borrador = row.movimiento_borrador as MovimientoBorrador
    return {
      id: row.id,
      codigo_producto: borrador.codigo_producto,
      cantidad: borrador.cantidad,
      bodega: borrador.bodega,
      motivo: borrador.motivo,
      estado: row.estado as AjusteMio['estado'],
      motivo_rechazo: row.motivo_rechazo,
      created_at: row.created_at,
      resuelto_at: row.resuelto_at,
    }
  })
}

export async function fetchAjustesPendientesCount(): Promise<number> {
  if (isDevBypassActive()) {
    return getDevPreviewAjustesData().length
  }

  const auth = await requireRole(['supervisor'])
  if (!auth.ok) return 0

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

  const auth = await requireRole(['supervisor'])
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }

  const supabase = await createClient()

  const { error } = await supabase.rpc('resolver_ajuste', {
    p_ajuste_id: id,
    p_decision: 'aprobado',
  })

  if (error) {
    console.error('Failed to resolve ajuste (aprobado):', error)
    return { ok: false, error: 'No se pudo aprobar el ajuste. Intenta de nuevo.' }
  }

  return { ok: true }
}

export async function rechazarAjuste(id: number, motivo: string): Promise<AjusteResultado> {
  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { ok: true }
  }

  const auth = await requireRole(['supervisor'])
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }

  const supabase = await createClient()

  const { error } = await supabase.rpc('resolver_ajuste', {
    p_ajuste_id: id,
    p_decision: 'rechazado',
    p_motivo_rechazo: motivo,
  })

  if (error) {
    console.error('Failed to resolve ajuste (rechazado):', error)
    return { ok: false, error: 'No se pudo rechazar el ajuste. Intenta de nuevo.' }
  }

  return { ok: true }
}
