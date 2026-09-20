'use server'

import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getDevPreviewUsuariosData } from '@/lib/dev/preview-usuarios-data'
import type { Role } from '@/lib/types/database'
import { crearUsuarioSchema, type CrearUsuarioInput, type UsuarioListado, type UsuarioResultado } from '@/lib/types/usuarios'

export async function fetchUsuarios(): Promise<UsuarioListado[]> {
  if (isDevBypassActive()) {
    return getDevPreviewUsuariosData()
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.usuarios)
  if (!auth.ok) return []

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, rol, activo, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to load profiles:', error)
    return []
  }

  return data ?? []
}

export async function actualizarRolUsuario(id: string, rol: Role): Promise<UsuarioResultado> {
  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return { ok: true }
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.usuarios)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('profiles').update({ rol }).eq('id', id)

  if (error) {
    console.error('Failed to update rol:', error)
    return { ok: false, error: 'No se pudo actualizar el rol. Intenta de nuevo.' }
  }

  return { ok: true }
}

export async function actualizarEstadoUsuario(
  id: string,
  activo: boolean
): Promise<UsuarioResultado> {
  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return { ok: true }
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.usuarios)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }

  const supabase = await createClient()

  if (!activo) {
    const { error } = await supabase.functions.invoke('desactivar-usuario', {
      body: { user_id: id },
    })
    if (error) {
      console.error('Failed to invoke desactivar-usuario:', error)
      return { ok: false, error: 'No se pudo desactivar el usuario. Intenta de nuevo.' }
    }
    return { ok: true }
  }

  const { error } = await supabase.functions.invoke('reactivar-usuario', {
    body: { user_id: id },
  })

  if (error) {
    console.error('Failed to invoke reactivar-usuario:', error)
    return { ok: false, error: 'No se pudo reactivar el usuario. Intenta de nuevo.' }
  }

  return { ok: true }
}

export async function crearUsuario(datos: CrearUsuarioInput): Promise<UsuarioResultado> {
  const parsed = crearUsuarioSchema.safeParse(datos)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos. Revisa el formulario.' }
  }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { ok: true }
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.usuarios)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }

  const supabase = await createClient()

  const { error } = await supabase.functions.invoke('crear-usuario', {
    body: parsed.data,
  })

  if (error) {
    console.error('Failed to invoke crear-usuario:', error)
    return { ok: false, error: 'No se pudo crear el usuario. Intenta de nuevo.' }
  }

  return { ok: true }
}
