import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // Cliente en CONTEXTO del usuario que llama, para verificar que es supervisor
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

  // B8: solo supervisor
  if (!perfil?.activo || perfil.rol !== 'supervisor') {
    return new Response(JSON.stringify({ error: 'Forbidden: solo supervisor puede crear usuarios' }), { status: 403 })
  }

  let body: { email?: string; nombre?: string; rol?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido, se esperaba JSON' }), { status: 400 })
  }

  const { email, nombre, rol } = body

  if (!email || !nombre || !rol) {
    return new Response(JSON.stringify({ error: 'email, nombre y rol son obligatorios' }), { status: 400 })
  }

  const rolesValidos = ['supervisor', 'comercial', 'metalmecanica', 'produccion', 'instalacion', 'compras', 'auditoria', 'lectura']
  if (!rolesValidos.includes(rol)) {
    return new Response(JSON.stringify({ error: `rol inválido, debe ser uno de: ${rolesValidos.join(', ')}` }), { status: 400 })
  }

  // Cliente ADMIN, con service_role, para usar auth.admin.*
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('MI_SERVICE_ROLE_KEY')!
  )

  // B8: flujo por invitación — email_confirm: true, SIN password en el body
  const { data: nuevoUsuario, error: errorCreacion } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    { data: { nombre } }
  )

  if (errorCreacion) {
    return new Response(JSON.stringify({ error: errorCreacion.message }), { status: 500 })
  }

  // El trigger handle_new_user ya creó el perfil con rol 'lectura' por defecto.
  // Lo actualizamos al rol real que pidió el supervisor.
  const { error: errorRol } = await supabaseAdmin
    .from('profiles')
    .update({ rol })
    .eq('id', nuevoUsuario.user.id)

  if (errorRol) {
    return new Response(JSON.stringify({ error: 'Usuario invitado pero falló asignar rol: ' + errorRol.message }), { status: 500 })
  }

  return new Response(JSON.stringify({
    ok: true,
    usuario: { id: nuevoUsuario.user.id, email: nuevoUsuario.user.email, nombre, rol }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
})