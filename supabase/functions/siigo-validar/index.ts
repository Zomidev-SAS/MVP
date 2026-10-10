import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { buscarProductoSiigo, buscarProveedorSiigo } from '../_shared/siigo-client.ts'

const ROLES_OC = ['supervisor', 'compras', 'produccion', 'metalmecanica', 'instalacion']

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('MI_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: userData } = await supabaseUser.auth.getUser(token)
  if (!userData?.user) {
    return json({ error: 'Token inválido' }, 401)
  }

  const { data: perfil } = await supabaseUser
    .from('profiles')
    .select('rol, activo')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (!perfil?.activo || !ROLES_OC.includes(perfil.rol)) {
    return json({ error: 'Sin permiso para validar contra Siigo' }, 403)
  }

  let body: { codigo_producto?: string; proveedor_nit?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const codigo = body.codigo_producto?.trim()
  if (!codigo) {
    return json({ error: 'codigo_producto es obligatorio' }, 400)
  }

  const proveedorNit = body.proveedor_nit?.trim() || null

  try {
    const producto = await buscarProductoSiigo(codigo)
    let proveedor = null as Awaited<ReturnType<typeof buscarProveedorSiigo>>

    if (proveedorNit) {
      proveedor = await buscarProveedorSiigo(proveedorNit)
    }

    return json({
      ok: true,
      producto: producto
        ? { encontrado: true, code: producto.code, name: producto.name, active: producto.active }
        : { encontrado: false },
      proveedor: proveedorNit
        ? proveedor
          ? {
              encontrado: true,
              identification: proveedor.identification,
              name: proveedor.name,
              active: proveedor.active,
            }
          : { encontrado: false }
        : null,
    })
  } catch (err) {
    console.error('siigo-validar error:', err)
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return json({ ok: false, error: msg }, 502)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
