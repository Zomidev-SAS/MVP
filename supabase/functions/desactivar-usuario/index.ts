import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('MI_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: userData } = await supabaseUser.auth.getUser(token)
  if (!userData?.user) {
    return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401 })
  }

  const { data: perfil } = await supabaseUser
    .from('profiles')
    .select('rol, activo')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (!perfil?.activo || perfil.rol !== 'supervisor') {
    return new Response(JSON.stringify({ error: 'Forbidden: solo supervisor puede desactivar usuarios' }), { status: 403 })
  }

  let body: { user_id?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido, se esperaba JSON' }), { status: 400 })
  }

  const { user_id } = body

  if (!user_id) {
    return new Response(JSON.stringify({ error: 'user_id es obligatorio' }), { status: 400 })
  }

  if (user_id === userData.user.id) {
    return new Response(JSON.stringify({ error: 'No puedes desactivarte a ti mismo' }), { status: 400 })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('MI_SERVICE_ROLE_KEY')!
  )

  // 1. Marcar activo = false en profiles
  const { error: errorPerfil } = await supabaseAdmin
    .from('profiles')
    .update({ activo: false })
    .eq('id', user_id)

  if (errorPerfil) {
    return new Response(JSON.stringify({ error: errorPerfil.message }), { status: 500 })
  }

  // 2. Banear al usuario (alternativa que el propio B8 permite a signOut)
  //    "876000h" ~ 100 años, efectivamente indefinido hasta que se reactive.
  const { error: errorBan } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
    ban_duration: '876000h'
  })

  if (errorBan) {
    return new Response(
      JSON.stringify({ ok: true, advertencia: 'Perfil desactivado, pero no se pudo banear: ' + errorBan.message }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(JSON.stringify({ ok: true, user_id, activo: false, baneado: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})