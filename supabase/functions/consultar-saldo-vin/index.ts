import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

Deno.serve(async (req) => {
  // 1. Solo GET
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  // 2. Requiere JWT del usuario (documento Sprint 5: "Autenticación: JWT del usuario")
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // 3. Leer el parámetro de la URL. Adaptado del documento original
  //    (?vin=ABC123) al esquema real: ?codigo_producto=XXXX
  const url = new URL(req.url)
  const codigoProducto = url.searchParams.get('codigo_producto')

  if (!codigoProducto || codigoProducto.trim() === '') {
    return new Response(
      JSON.stringify({ error: 'El parámetro codigo_producto es obligatorio' }),
      { status: 400 }
    )
  }

  // 4. Cliente con el CONTEXTO del usuario que llama (no service_role),
  //    para que RLS y el enmascarado de costos (B3) apliquen automáticamente
  //    según el rol real de quien pregunta.
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

  // 5. Consultar el saldo — usa la MISMA vista que ya tiene el enmascarado
  //    de costos, así que un rol sin permiso ve valor_unitario/valor_total en null
  const { data, error } = await supabaseUser
    .from('vista_inventario_actual')
    .select('codigo_producto, nombre_producto, unidad_medida, categoria, saldo, valor_unitario, valor_total, ultimo_movimiento')
    .eq('codigo_producto', codigoProducto)
    .maybeSingle()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!data) {
    return new Response(
      JSON.stringify({ error: 'Producto no encontrado o sin movimientos aplicados' }),
      { status: 404 }
    )
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})