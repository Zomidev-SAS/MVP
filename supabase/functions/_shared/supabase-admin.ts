import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function assertSupervisor(authHeader: string | null) {
  if (!authHeader) {
    throw new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const token = authHeader.replace(/^Bearer\s+/i, '')
  const admin = createAdminClient()
  const { data: userData, error: userError } = await admin.auth.getUser(token)

  if (userError || !userData.user) {
    throw new Response(JSON.stringify({ error: 'Sesión inválida' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('rol, activo')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile || profile.rol !== 'supervisor' || profile.activo !== true) {
    throw new Response(JSON.stringify({ error: 'Solo el supervisor puede ejecutar esta acción' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return userData.user
}
