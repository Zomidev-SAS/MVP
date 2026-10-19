// B12: crea la factura de compra (FC) en Siigo cuando la OC se marca como
// 'listo' (rpc_marcar_oc_listo, 053). rpc_aprobar_oc_siigo (044/054) queda
// como reintento manual. El panel nunca llama esta función directo, siempre
// a través de esos RPC o del reintento automático de B7.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { isValidServiceRoleRequest } from '../_shared/internal-auth.ts'
import { crearDocumentoCompraSiigo, type OrdenCompraParaSiigo } from '../_shared/siigo-client.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }
  if (!isValidServiceRoleRequest(req)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let body: { orden_id?: number; sync_pendiente_id?: number }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body inválido, se esperaba JSON' }, 400)
  }

  const ordenId = body.orden_id
  if (!ordenId) {
    return json({ error: 'orden_id es obligatorio' }, 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('MI_SERVICE_ROLE_KEY')!
  )

  const logId = await iniciarLog(admin, 'siigo_sync_oc', { orden_id: ordenId })

  const { data: orden, error: ordenErr } = await admin
    .from('ordenes_compra')
    .select('id, titulo, fecha_pedido, proveedor_nit, observaciones, medio_pago, siigo_id, siigo_estado')
    .eq('id', ordenId)
    .maybeSingle()

  if (ordenErr || !orden) {
    await cerrarLog(admin, logId, 'error', 0, ordenErr?.message ?? 'Orden no encontrada')
    return json({ error: ordenErr?.message ?? 'Orden no encontrada' }, 404)
  }

  // Idempotencia: si ya tiene siigo_id, nunca se vuelve a crear.
  if (orden.siigo_id) {
    await cerrarLog(admin, logId, 'ok', 0)
    await marcarResuelto(admin, body.sync_pendiente_id)
    return json({ ok: true, ya_sincronizada: true, siigo_id: orden.siigo_id })
  }

  const { data: items, error: itemsErr } = await admin
    .from('orden_compra_items')
    .select('codigo_producto, descripcion, cantidad')
    .eq('orden_id', ordenId)

  if (itemsErr) {
    await cerrarLog(admin, logId, 'error', 0, itemsErr.message)
    return json({ error: itemsErr.message }, 500)
  }

  const ordenParaSiigo: OrdenCompraParaSiigo = {
    id: orden.id,
    titulo: orden.titulo,
    fecha_pedido: orden.fecha_pedido,
    proveedor_nit: orden.proveedor_nit,
    observaciones: orden.observaciones,
    medio_pago: orden.medio_pago ?? null,
    items: (items ?? []).map((it) => ({
      codigo_producto: it.codigo_producto,
      descripcion: it.descripcion,
      cantidad: Number(it.cantidad),
    })),
  }

  try {
    const doc = await crearDocumentoCompraSiigo(ordenParaSiigo)

    await admin
      .from('ordenes_compra')
      .update({ siigo_id: doc.id, siigo_referencia: doc.numero, siigo_estado: 'sincronizada' })
      .eq('id', ordenId)

    await cerrarLog(admin, logId, 'ok', 1)
    await marcarResuelto(admin, body.sync_pendiente_id)

    return json({ ok: true, ya_sincronizada: false, siigo_id: doc.id, siigo_referencia: doc.numero })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'

    await admin.from('ordenes_compra').update({ siigo_estado: 'error' }).eq('id', ordenId)
    await cerrarLog(admin, logId, 'error', 0, msg)
    await registrarFalla(admin, body.sync_pendiente_id, ordenId, body, msg)

    return json({ ok: false, error: msg }, 502)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// deno-lint-ignore no-explicit-any
async function iniciarLog(admin: any, regla: string, detalle: unknown): Promise<number | null> {
  const { data } = await admin.rpc('fn_log_automatizacion_iniciar', { p_regla: regla, p_detalle: detalle })
  return data ?? null
}

// deno-lint-ignore no-explicit-any
async function cerrarLog(admin: any, logId: number | null, resultado: string, filas: number, error?: string) {
  if (!logId) return
  await admin.rpc('fn_log_automatizacion_cerrar', {
    p_id: logId, p_resultado: resultado, p_filas_afectadas: filas, p_error: error ?? null,
  })
}

// deno-lint-ignore no-explicit-any
async function marcarResuelto(admin: any, syncPendienteId?: number) {
  if (!syncPendienteId) return
  await admin.rpc('fn_registrar_intento_sync', { p_id: syncPendienteId, p_exitoso: true })
}

// deno-lint-ignore no-explicit-any
async function registrarFalla(admin: any, syncPendienteId: number | undefined, ordenId: number, payload: unknown, motivo: string) {
  if (syncPendienteId) {
    await admin.rpc('fn_registrar_intento_sync', { p_id: syncPendienteId, p_exitoso: false, p_motivo: motivo })
    return
  }

  await admin.rpc('fn_encolar_sync_pendiente', {
    p_tipo: 'siigo_oc',
    p_referencia_id: String(ordenId),
    p_payload: payload,
    p_motivo: motivo,
  })

  // B3: errores de Siigo -> compras.
  await admin.rpc('fn_crear_notificacion', {
    p_tipo: 'siigo_error',
    p_titulo: 'Error enviando una OC a Siigo',
    p_mensaje: `La orden #${ordenId} no se pudo sincronizar con Siigo: ${motivo}`,
    p_enlace: `/compras/${ordenId}`,
    p_usuario_destino: null,
    p_rol_destino: 'compras',
  })
}
