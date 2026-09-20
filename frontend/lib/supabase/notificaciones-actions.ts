'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { fetchAjustesPendientesCount } from '@/lib/supabase/ajustes-actions'
import { fetchProductosBajoStock } from '@/lib/supabase/inventario-actions'
import type {
  AlertaNotificacion,
  MensajePanel,
  NotificacionesPayload,
} from '@/lib/types/notificaciones'

const mensajeSchema = z.object({
  titulo: z.string().trim().min(1),
  cuerpo: z.string().trim().min(1),
  nivel: z.enum(['info', 'aviso', 'urgente']),
  rol_destino: z.string().optional(),
})

export async function fetchNotificaciones(rol: string): Promise<NotificacionesPayload> {
  const alertas: AlertaNotificacion[] = []

  const [productos, ajustesCount, mensajes] = await Promise.all([
    fetchProductosBajoStock(15),
    rol === 'supervisor' ? fetchAjustesPendientesCount().catch(() => 0) : Promise.resolve(0),
    fetchMensajesInternos(),
  ])

  if (productos.length > 0) {
    alertas.push({
      tipo: 'stock_bajo',
      id: 'stock-bajo',
      titulo: 'Stock bajo',
      resumen: `${productos.length} producto${productos.length === 1 ? '' : 's'} bajo el umbral configurado`,
      href: '/inventario',
      productos,
    })
  }

  if (ajustesCount > 0) {
    alertas.push({
      tipo: 'ajustes_pendientes',
      id: 'ajustes-pendientes',
      titulo: 'Ajustes pendientes',
      resumen: `${ajustesCount} solicitud${ajustesCount === 1 ? '' : 'es'} esperando tu aprobación`,
      href: '/ajustes',
      cantidad: ajustesCount,
    })
  }

  const mensajesNoLeidos = mensajes.filter((m) => !m.leido).length

  return {
    alertas,
    mensajes,
    totalSinLeer: alertas.length + mensajesNoLeidos,
  }
}

async function fetchMensajesInternos(): Promise<MensajePanel[]> {
  if (isDevBypassActive()) {
    return [
      {
        id: 1,
        titulo: 'Bienvenido al panel',
        cuerpo: 'Revisa inventario y formularios desde el menú lateral.',
        nivel: 'info',
        rol_destino: null,
        created_at: new Date().toISOString(),
        leido: false,
      },
    ]
  }

  const user = await getSessionUser()
  if (!user) return []

  const supabase = await createClient()

  const { data: mensajes, error } = await supabase
    .from('mensajes_panel')
    .select('id, titulo, cuerpo, nivel, rol_destino, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error('Failed to load mensajes_panel:', error)
    return []
  }

  const { data: leidos } = await supabase
    .from('mensajes_leidos')
    .select('mensaje_id')
    .eq('usuario_id', user.id)

  const leidosSet = new Set((leidos ?? []).map((r) => r.mensaje_id))

  return (mensajes ?? []).map((m) => ({
    ...m,
    leido: leidosSet.has(m.id),
  }))
}

export async function marcarMensajeLeido(
  mensajeId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isDevBypassActive()) {
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sin sesión.' }

  const supabase = await createClient()
  const { error } = await supabase.from('mensajes_leidos').upsert({
    mensaje_id: mensajeId,
    usuario_id: user.id,
  })

  if (error) {
    return { ok: false, error: 'No se pudo marcar como leído.' }
  }

  return { ok: true }
}

export async function crearMensajePanel(datos: {
  titulo: string
  cuerpo: string
  nivel: 'info' | 'aviso' | 'urgente'
  rol_destino?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = mensajeSchema.safeParse(datos)
  if (!parsed.success) {
    return { ok: false, error: 'Datos del mensaje inválidos.' }
  }

  if (isDevBypassActive()) {
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sin sesión.' }

  const supabase = await createClient()
  const { error } = await supabase.from('mensajes_panel').insert({
    titulo: parsed.data.titulo,
    cuerpo: parsed.data.cuerpo,
    nivel: parsed.data.nivel,
    rol_destino: parsed.data.rol_destino || null,
    created_by: user.id,
  })

  if (error) {
    console.error('Failed to create mensaje:', error)
    return { ok: false, error: 'No se pudo publicar el mensaje.' }
  }

  return { ok: true }
}
