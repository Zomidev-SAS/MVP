'use server'

import { validatePassword } from '@/lib/auth/password-policy'
import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getSessionUser } from '@/lib/supabase/get-session-user'

export type CambiarPasswordResult = { ok: true } | { ok: false; error: string }

export async function cambiarPassword(datos: {
  passwordActual: string
  passwordNueva: string
}): Promise<CambiarPasswordResult> {
  const passwordCheck = validatePassword(datos.passwordNueva)
  if (!passwordCheck.ok) {
    return passwordCheck
  }
  if (datos.passwordActual === datos.passwordNueva) {
    return { ok: false, error: 'La nueva contraseña debe ser distinta a la actual.' }
  }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user?.email) {
    return { ok: false, error: 'No hay sesión activa. Vuelve a iniciar sesión.' }
  }

  const supabase = await createClient()

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: datos.passwordActual,
  })

  if (verifyError) {
    return { ok: false, error: 'La contraseña actual no es correcta.' }
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: datos.passwordNueva,
  })

  if (updateError) {
    console.error('Failed to update password:', updateError)
    return { ok: false, error: 'No se pudo guardar la nueva contraseña. Intenta de nuevo.' }
  }

  return { ok: true }
}
