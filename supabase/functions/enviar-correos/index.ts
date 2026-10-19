// B13: procesa cola_correos y envía por Resend. Se dispara cada minuto desde
// pg_cron (fn_disparar_envio_correos, 040) solo cuando hay filas pendientes.
//
// Antispam (3.13): varias filas pendientes con el mismo (destinatario, tipo)
// se agrupan en un solo correo — ninguna se pierde, pero no se manda una
// explosión de correos individuales si, por ejemplo, 10 productos cruzan el
// umbral de stock bajo casi al mismo tiempo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { isValidServiceRoleRequest } from '../_shared/internal-auth.ts'

const RESEND_API = 'https://api.resend.com/emails'
const LOTE = 200

interface FilaCorreo {
  id: number
  destinatario: string
  tipo: string
  asunto: string
  cuerpo: string
  enlace: string | null
  intentos: number
  max_intentos: number
  adjunto_nombre: string | null
  adjunto_base64: string | null
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
    p_regla: 'enviar_correos',
    p_detalle: null,
  })

  const { data: pendientes, error } = await admin
    .from('cola_correos')
    .select('id, destinatario, tipo, asunto, cuerpo, enlace, intentos, max_intentos, adjunto_nombre, adjunto_base64')
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: true })
    .limit(LOTE)

  if (error) {
    await admin.rpc('fn_log_automatizacion_cerrar', {
      p_id: logId, p_resultado: 'error', p_filas_afectadas: 0, p_error: error.message,
    })
    return json({ error: error.message }, 500)
  }

  const filas = (pendientes ?? []) as FilaCorreo[]
  if (filas.length === 0) {
    await admin.rpc('fn_log_automatizacion_cerrar', { p_id: logId, p_resultado: 'ok', p_filas_afectadas: 0 })
    return json({ ok: true, enviados: 0 })
  }

  // Agrupar por (destinatario, tipo): la primera fila del grupo es la que se
  // envía; el resto queda marcado 'agrupado' apuntando a ella.
  const grupos = new Map<string, FilaCorreo[]>()
  for (const f of filas) {
    const clave = `${f.destinatario}::${f.tipo}`
    const arr = grupos.get(clave) ?? []
    arr.push(f)
    grupos.set(clave, arr)
  }

  let enviados = 0
  let fallidos = 0

  for (const grupo of grupos.values()) {
    const principal = grupo[0]
    const resto = grupo.slice(1)

    if (resto.length > 0) {
      await admin
        .from('cola_correos')
        .update({ estado: 'agrupado', agrupado_en: principal.id })
        .in('id', resto.map((r) => r.id))
    }

    await admin.from('cola_correos').update({ estado: 'enviando' }).eq('id', principal.id)

    try {
      const html = renderPlantilla(grupo)
      const asunto = resto.length > 0
        ? `${principal.asunto} (+${resto.length} más)`
        : principal.asunto

      await enviarConResend(
        principal.destinatario,
        asunto,
        html,
        principal.adjunto_nombre && principal.adjunto_base64
          ? { nombre: principal.adjunto_nombre, base64: principal.adjunto_base64 }
          : undefined
      )

      await admin
        .from('cola_correos')
        .update({ estado: 'enviado', enviado_at: new Date().toISOString() })
        .eq('id', principal.id)

      enviados++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      const intentos = principal.intentos + 1
      const agotado = intentos >= principal.max_intentos

      await admin
        .from('cola_correos')
        .update({
          estado: agotado ? 'error' : 'pendiente',
          intentos,
          error: msg,
        })
        .eq('id', principal.id)

      if (agotado) {
        await admin.rpc('fn_crear_notificacion', {
          p_tipo: 'correo_fallido',
          p_titulo: 'Un correo no se pudo enviar tras 5 intentos',
          p_mensaje: `Destinatario ${principal.destinatario}, asunto "${principal.asunto}": ${msg}`,
          p_enlace: '/automatizaciones',
          p_usuario_destino: null,
          p_rol_destino: 'supervisor',
        })
      }

      fallidos++
    }
  }

  await admin.rpc('fn_log_automatizacion_cerrar', {
    p_id: logId,
    p_resultado: fallidos > 0 && enviados === 0 ? 'error' : 'ok',
    p_filas_afectadas: enviados,
    p_error: fallidos > 0 ? `${fallidos} correo(s) con error` : null,
  })

  return json({ ok: true, enviados, fallidos, grupos: grupos.size })
})

async function enviarConResend(
  destinatario: string,
  asunto: string,
  html: string,
  adjunto?: { nombre: string; base64: string }
): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  // El proyecto cloud ya tiene el remitente verificado en el secret
  // RESEND_FROM (lo usa generar-pdf-email); RESEND_FROM_EMAIL se acepta
  // como alias para no romper entornos que lo hayan configurado así.
  const from =
    Deno.env.get('RESEND_FROM_EMAIL') ??
    Deno.env.get('RESEND_FROM') ??
    'Panel Carrera Arango <notificaciones@carrera-arango.com>'

  if (!apiKey) {
    throw new Error('RESEND_API_KEY no configurado')
  }

  const payload: Record<string, unknown> = { from, to: [destinatario], subject: asunto, html }
  if (adjunto) {
    payload.attachments = [{ filename: adjunto.nombre, content: adjunto.base64 }]
  }

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend (${res.status}): ${body.slice(0, 300)}`)
  }
}

function renderPlantilla(items: FilaCorreo[]): string {
  const base = Deno.env.get('PANEL_BASE_URL') ?? 'https://carrera.zomidev.com'
  const rojo = '#D91F26'
  const negro = '#111111'
  const fondo = '#F4F4F5'
  const linea = '#E4E4E7'
  const fuente = "Inter,'Helvetica Neue',Arial,sans-serif"

  const bloques = items.map((it) => `
    <tr>
      <td style="padding:22px 0;border-bottom:1px solid ${linea};">
        <p style="margin:0 0 8px 0;font-family:${fuente};font-size:17px;font-weight:700;color:${negro};line-height:1.3;">
          ${escapeHtml(it.asunto)}
        </p>
        <p style="margin:0;font-family:${fuente};font-size:14px;color:#3F3F46;line-height:1.6;">
          ${escapeHtml(it.cuerpo).replace(/\n/g, '<br>')}
        </p>
        ${it.enlace ? `
        <a href="${base}${it.enlace}"
           style="display:inline-block;margin-top:16px;padding:11px 22px;background:${rojo};
                  color:#FFFFFF;text-decoration:none;font-family:${fuente};font-size:13px;
                  font-weight:700;letter-spacing:0.3px;border-radius:6px;">
          Ver en el panel
        </a>` : ''}
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  </head>
  <body style="margin:0;padding:32px 16px;background:${fondo};">
    <table role="presentation" width="100%" style="max-width:600px;margin:0 auto;background:#FFFFFF;
           border-radius:10px;overflow:hidden;border:1px solid ${linea};" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:28px 24px 20px 24px;background:#FFFFFF;">
          <img src="${base}/logo.png" alt="Carrera Arango Transformaciones" width="96"
               style="display:block;width:96px;height:auto;border:0;">
        </td>
      </tr>
      <tr><td style="height:5px;background:${rojo};font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr>
        <td style="padding:6px 32px 12px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${bloques}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px;background:${negro};">
          <p style="margin:0 0 4px 0;font-family:${fuente};font-size:12px;font-weight:700;color:#FFFFFF;">
            Panel Carrera Arango
          </p>
          <p style="margin:0;font-family:${fuente};font-size:11px;color:#A1A1AA;line-height:1.5;">
            Este correo se generó automáticamente desde el panel de Carrera Arango.<br>
            Zomidev S.A.S. · "El lujo del detalle"
          </p>
        </td>
      </tr>
    </table>
  </body>
  </html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
