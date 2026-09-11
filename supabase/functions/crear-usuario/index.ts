import { corsHeaders } from '../_shared/cors.ts'
import { assertSupervisor, createAdminClient } from '../_shared/supabase-admin.ts'

const VALID_ROLES = [
  'supervisor',
  'comercial',
  'ingenieria',
  'produccion',
  'compras',
  'auditoria',
  'lectura',
] as const

type Role = (typeof VALID_ROLES)[number]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    await assertSupervisor(req.headers.get('Authorization'))
    const { nombre, email, password, rol } = await req.json()

    if (!nombre?.trim() || !email?.trim() || !password || !rol) {
      return new Response(JSON.stringify({ error: 'nombre, email, password y rol son requeridos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 8 caracteres' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!VALID_ROLES.includes(rol as Role)) {
      return new Response(JSON.stringify({ error: 'Rol inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createAdminClient()

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { nombre: nombre.trim() },
    })

    if (createError || !created.user) {
      const message =
        createError?.message?.toLowerCase().includes('already') ||
        createError?.message?.toLowerCase().includes('registered')
          ? 'El correo ya está registrado'
          : 'No se pudo crear el usuario'
      return new Response(JSON.stringify({ error: message }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: profileError } = await admin.from('profiles').upsert({
      id: created.user.id,
      nombre: nombre.trim(),
      rol,
      activo: true,
    })

    if (profileError) {
      console.error('Failed to upsert profile:', profileError)
      await admin.auth.admin.deleteUser(created.user.id)
      return new Response(JSON.stringify({ error: 'Usuario creado pero falló el perfil' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, id: created.user.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (response) {
    if (response instanceof Response) return response
    console.error('crear-usuario error:', response)
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
