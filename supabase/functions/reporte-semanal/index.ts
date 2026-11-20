// B14: reporte semanal automático, lunes 7:00 a.m. (pg_cron, migración 046).
// Resume la semana (lunes a domingo anterior) desde kpi_diario y lo manda
// con un CSV adjunto, encolado en cola_correos (igual que toda otra alerta),
// solo al rol supervisor — sin costos para quien no tiene permiso de verlos.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { isValidServiceRoleRequest } from '../_shared/internal-auth.ts'

interface FilaKpi {
  fecha: string
  unidades_entrada: number
  valor_entrada: number
  unidades_salida: number
  valor_salida: number
  alertas_stock_bajo: number
  ajustes_creados: number
  ajustes_resueltos: number
  oc_creadas: number
  oc_abiertas: number
  oc_vencidas: number
  oc_sincronizadas_siigo: number
  vehiculos_por_etapa: Record<string, number>
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }
  if (!isValidServiceRoleRequest(req)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('MI_SERVICE_ROLE_KEY')!
  )

  const { data: logId } = await admin.rpc('fn_log_automatizacion_iniciar', {
    p_regla: 'reporte_semanal', p_detalle: null,
  })

  try {
    const hoy = new Date()
    const hace7 = new Date(hoy)
    hace7.setDate(hoy.getDate() - 7)
    const desde = hace7.toISOString().slice(0, 10)
    const hasta = hoy.toISOString().slice(0, 10)

    const { data: filas, error } = await admin
      .from('kpi_diario')
      .select('*')
      .gte('fecha', desde)
      .lt('fecha', hasta)
      .order('fecha', { ascending: true })

    if (error) throw new Error(error.message)

    const dias = (filas ?? []) as FilaKpi[]

    const totales = dias.reduce(
      (acc, d) => ({
        unidades_entrada: acc.unidades_entrada + Number(d.unidades_entrada ?? 0),
        valor_entrada: acc.valor_entrada + Number(d.valor_entrada ?? 0),
        unidades_salida: acc.unidades_salida + Number(d.unidades_salida ?? 0),
        valor_salida: acc.valor_salida + Number(d.valor_salida ?? 0),
        ajustes_creados: acc.ajustes_creados + Number(d.ajustes_creados ?? 0),
        ajustes_resueltos: acc.ajustes_resueltos + Number(d.ajustes_resueltos ?? 0),
        oc_creadas: acc.oc_creadas + Number(d.oc_creadas ?? 0),
      }),
      { unidades_entrada: 0, valor_entrada: 0, unidades_salida: 0, valor_salida: 0, ajustes_creados: 0, ajustes_resueltos: 0, oc_creadas: 0 }
    )

    const ultimoDia = dias[dias.length - 1]
    const etapas = ultimoDia?.vehiculos_por_etapa ?? {}
    const etapasTxt = Object.entries(etapas).map(([k, v]) => `${k}: ${v}`).join(', ') || 'sin datos'

    const csv = construirCsv(dias)
    const csvBase64 = base64Encode(csv)

    const cuerpo =
      `Resumen del ${desde} al ${hasta}:\n` +
      `• Entradas: ${totales.unidades_entrada} unidades ($${totales.valor_entrada.toLocaleString('es-CO')})\n` +
      `• Salidas: ${totales.unidades_salida} unidades ($${totales.valor_salida.toLocaleString('es-CO')})\n` +
      `• Stock bajo (alertas abiertas al cierre): ${ultimoDia?.alertas_stock_bajo ?? 0}\n` +
      `• Ajustes creados / resueltos: ${totales.ajustes_creados} / ${totales.ajustes_resueltos}\n` +
      `• OC creadas: ${totales.oc_creadas} · abiertas: ${ultimoDia?.oc_abiertas ?? 0} · vencidas: ${ultimoDia?.oc_vencidas ?? 0} · sincronizadas con Siigo: ${ultimoDia?.oc_sincronizadas_siigo ?? 0}\n` +
      `• Vehículos por etapa: ${etapasTxt}\n\n` +
      `El detalle día a día va en el CSV adjunto.`

    const { data: supervisores } = await admin
      .from('profiles')
      .select('id')
      .eq('rol', 'supervisor')
      .eq('activo', true)

    let encolados = 0
    for (const s of supervisores ?? []) {
      await admin.rpc('fn_encolar_correo', {
        p_usuario_id: s.id,
        p_tipo: 'reporte_semanal',
        p_asunto: `Reporte semanal Carrera Arango — ${desde} a ${hasta}`,
        p_cuerpo: cuerpo,
        p_origen: `reporte_semanal:${desde}:${hasta}`,
        p_enlace: '/dashboard',
        p_adjunto_nombre: `reporte_semanal_${desde}_a_${hasta}.csv`,
        p_adjunto_base64: csvBase64,
      })
      encolados++
    }

    await admin.rpc('fn_log_automatizacion_cerrar', {
      p_id: logId, p_resultado: 'ok', p_filas_afectadas: encolados, p_error: null,
    })

    return json({ ok: true, encolados, dias: dias.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    await admin.rpc('fn_log_automatizacion_cerrar', {
      p_id: logId, p_resultado: 'error', p_filas_afectadas: 0, p_error: msg,
    })
    return json({ ok: false, error: msg }, 500)
  }
})

function construirCsv(dias: FilaKpi[]): string {
  const encabezado = [
    'fecha', 'unidades_entrada', 'valor_entrada', 'unidades_salida', 'valor_salida',
    'alertas_stock_bajo', 'ajustes_creados', 'ajustes_resueltos',
    'oc_creadas', 'oc_abiertas', 'oc_vencidas', 'oc_sincronizadas_siigo',
  ].join(',')

  const filas = dias.map((d) => [
    d.fecha, d.unidades_entrada, d.valor_entrada, d.unidades_salida, d.valor_salida,
    d.alertas_stock_bajo, d.ajustes_creados, d.ajustes_resueltos,
    d.oc_creadas, d.oc_abiertas, d.oc_vencidas, d.oc_sincronizadas_siigo,
  ].join(','))

  return [encabezado, ...filas].join('\n')
}

function base64Encode(texto: string): string {
  const bytes = new TextEncoder().encode(texto)
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return btoa(binario)
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
