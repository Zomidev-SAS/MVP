import { corsHeaders } from '../_shared/cors.ts'
import { assertSupervisor, createAdminClient } from '../_shared/supabase-admin.ts'

type MovimientoBorrador = {
  vin: string
  cantidad: number
  motivo: string
  evidencia?: { descripcion?: string }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supervisor = await assertSupervisor(req.headers.get('Authorization'))
    const { ajuste_id } = await req.json()

    if (!ajuste_id || typeof ajuste_id !== 'number') {
      return new Response(JSON.stringify({ error: 'ajuste_id requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createAdminClient()

    const { data: ajuste, error: fetchError } = await admin
      .from('ajustes_pendientes')
      .select('id, movimiento_borrador, solicitado_por, estado')
      .eq('id', ajuste_id)
      .single()

    if (fetchError || !ajuste) {
      return new Response(JSON.stringify({ error: 'Ajuste no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (ajuste.estado !== 'pendiente') {
      return new Response(JSON.stringify({ error: 'El ajuste ya fue resuelto' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const borrador = ajuste.movimiento_borrador as MovimientoBorrador
    const now = new Date().toISOString()

    const { error: insertError } = await admin.from('movimientos_inventario').insert({
      vin: borrador.vin,
      tipo_movimiento: 'ajuste',
      cantidad: borrador.cantidad,
      motivo: borrador.motivo,
      evidencia: borrador.evidencia ?? {},
      actor_id: ajuste.solicitado_por,
      aprobado_por: supervisor.id,
      estado: 'aplicado',
      idempotency_key: `ajuste-aprobado-${ajuste.id}`,
    })

    if (insertError) {
      console.error('Failed to insert movimiento from ajuste:', insertError)
      return new Response(JSON.stringify({ error: 'No se pudo aplicar el ajuste' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: updateError } = await admin
      .from('ajustes_pendientes')
      .update({
        estado: 'aprobado',
        resuelto_por: supervisor.id,
        resuelto_at: now,
      })
      .eq('id', ajuste_id)

    if (updateError) {
      console.error('Failed to update ajuste_pendiente:', updateError)
      return new Response(JSON.stringify({ error: 'Movimiento creado pero falló actualizar el ajuste' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (response) {
    if (response instanceof Response) return response
    console.error('aprobar-ajuste error:', response)
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
