import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import type { Profile, Role } from '@/lib/types/database'
import type { User } from '@supabase/supabase-js'

export type RequireRoleResult =
  | { ok: true; user: User; profile: Profile }
  | { ok: false; error: string }

export async function requireRole(allowed: readonly Role[]): Promise<RequireRoleResult> {
  const result = await getCurrentProfile()

  if (result.status === 'no-session') {
    return { ok: false, error: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  if (result.status === 'no-profile') {
    return { ok: false, error: 'No se pudo cargar tu perfil.' }
  }

  if (!result.profile.activo) {
    return { ok: false, error: 'Cuenta inactiva.' }
  }

  if (!allowed.includes(result.profile.rol)) {
    return { ok: false, error: 'No autorizado para esta acción.' }
  }

  return { ok: true, user: result.user, profile: result.profile }
}
