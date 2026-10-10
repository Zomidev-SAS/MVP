import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { isValidServiceRoleRequest } from '../_shared/internal-auth.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  if (!isValidServiceRoleRequest(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  let body: {
    formulario_id?: string
    codigo_producto?: string
    bodega?: string
    // Presente solo cuando esta llamada es un reintento disparado por el
    // cron de B7 (fn_reintentar_sync_pendientes, cada 5 minutos). Sirve para
    // cerrar o reprogramar la fila de sync_pendientes al terminar.
    sync_pendiente_id?: number
  }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido, se esperaba JSON' }), { status: 400 })
  }

  const { formulario_id, codigo_producto, bodega, sync_pendiente_id } = body

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('MI_SERVICE_ROLE_KEY')!
  )

  if (!formulario_id || !codigo_producto || codigo_producto.trim() === '' || !bodega) {
    const msg = 'formulario_id, codigo_producto y bodega son obligatorios'
    await registrarFalla(supabaseAdmin, sync_pendiente_id, null, body, msg)
    return new Response(JSON.stringify({ error: msg }), { status: 400 })
  }

  const idempotencyKey = `formulario:${formulario_id}`

  try {
    const { data: existente } = await supabaseAdmin
      .from('movimientos_inventario')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (existente) {
      await marcarResuelto(supabaseAdmin, sync_pendiente_id)
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
      // Rechazo de negocio, no una falla técnica: no se encola para
      // reintento automático (reintentar no cambia el saldo por sí solo).
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
      await registrarFalla(supabaseAdmin, sync_pendiente_id, formulario_id, body, error.message)
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    await marcarResuelto(supabaseAdmin, sync_pendiente_id)
    return new Response(JSON.stringify({ ok: true, duplicado: false, movimiento }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    await registrarFalla(supabaseAdmin, sync_pendiente_id, formulario_id ?? null, body, msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})

// deno-lint-ignore no-explicit-any
async function marcarResuelto(admin: any, syncPendienteId?: number) {
  if (!syncPendienteId) return
  await admin.rpc('fn_registrar_intento_sync', { p_id: syncPendienteId, p_exitoso: true })
}

// B3 + B7: una falla real (no un rechazo de negocio) se registra siempre en
// sync_pendientes y notifica al supervisor (una sola vez, al encolar; los
// reintentos posteriores solo reprograman o cierran, sin notificar de nuevo
// hasta que se agoten los 5 intentos — eso lo hace fn_registrar_intento_sync).
// deno-lint-ignore no-explicit-any
async function registrarFalla(
  admin: any,
  syncPendienteId: number | undefined,
  formularioId: string | null,
  payload: unknown,
  motivo: string
) {
  if (syncPendienteId) {
    await admin.rpc('fn_registrar_intento_sync', {
      p_id: syncPendienteId,
      p_exitoso: false,
      p_motivo: motivo
    })
    return
  }

  await admin.rpc('fn_encolar_sync_pendiente', {
    p_tipo: 'sync_vin',
    p_referencia_id: formularioId ?? 'desconocido',
    p_payload: payload,
    p_motivo: motivo
  })

  await admin.rpc('fn_crear_notificacion', {
    p_tipo: 'sync_vin_fallida',
    p_titulo: 'Falló la sincronización de un ingreso',
    p_mensaje: `El formulario ${formularioId ?? 'desconocido'} no se pudo sincronizar: ${motivo}`,
    p_enlace: '/automatizaciones',
    p_usuario_destino: null,
    p_rol_destino: 'supervisor'
  })
}