import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  let body: { formulario_id?: string; codigo_producto?: string; bodega?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido, se esperaba JSON' }), { status: 400 })
  }

  const { formulario_id, codigo_producto, bodega } = body

  if (!formulario_id || !codigo_producto || codigo_producto.trim() === '' || !bodega) {
    return new Response(
      JSON.stringify({ error: 'formulario_id, codigo_producto y bodega son obligatorios' }),
      { status: 400 }
    )
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('MI_SERVICE_ROLE_KEY')!
  )

  const idempotencyKey = `formulario:${formulario_id}`

  const { data: existente } = await supabaseAdmin
    .from('movimientos_inventario')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existente) {
    return new Response(JSON.stringify({ ok: true, duplicado: true, movimiento: existente }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Saldo de ESA bodega específica, no el total agregado
  const { data: inventario } = await supabaseAdmin
    .from('vista_inventario_por_bodega')
    .select('saldo')
    .eq('codigo_producto', codigo_producto)
    .eq('bodega', bodega)
    .maybeSingle()

  const saldoActual = inventario?.saldo ?? 0

  const { data: config } = await supabaseAdmin
    .from('config_app')
    .select('bloquear_sin_stock')
    .eq('id', 1)
    .maybeSingle()

  const bloquearSinStock = config?.bloquear_sin_stock ?? false

  if (bloquearSinStock && saldoActual <= 0) {
    return new Response(
      JSON.stringify({
        error: 'Producto sin saldo disponible en esa bodega',
        detalle: `El producto ${codigo_producto} en ${bodega} tiene saldo ${saldoActual}, no se puede registrar una salida.`
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { data: movimiento, error } = await supabaseAdmin
    .from('movimientos_inventario')
    .insert({
      codigo_producto,
      tipo_movimiento: 'salida_vin',
      cantidad: -1,
      bodega,
      formulario_id,
      actor_id: Deno.env.get('SYSTEM_ACTOR_ID'),
      idempotency_key: idempotencyKey
    })
    .select()
    .single()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true, duplicado: false, movimiento }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})