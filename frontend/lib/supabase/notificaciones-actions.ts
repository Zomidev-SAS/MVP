'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { fetchAjustesPendientesCount } from '@/lib/supabase/ajustes-actions'
import { fetchEventosHoy } from '@/lib/supabase/calendario-actions'
import { fetchProductosBajoStock } from '@/lib/supabase/inventario-actions'
import { fetchOrdenesCompraPendientes } from '@/lib/supabase/ordenes-compra-actions'
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

/**
 * Firma del contenido de una alerta sintética: no identifica la categoría,
 * identifica QUÉ hay dentro de ella en este momento (ids ordenados). Si el
 * contenido cambia (un producto nuevo bajo el umbral, una OC nueva vencida),
 * la firma cambia, y marcar-leída con la firma vieja ya no aplica — ver
 * migración 049.
 */
function firmaStockBajo(productos: { codigo_producto: string }[]): string {
  return productos.map((p) => p.codigo_producto).sort().join(',')
}
function firmaAjustes(cantidad: number): string {
  return String(cantidad)
}
function firmaOrdenesCompra(ordenes: { id: number }[]): string {
  return ordenes.map((o) => o.id).sort((a, b) => a - b).join(',')
}
function firmaEventosHoy(eventos: { id: number }[]): string {
  return eventos.map((e) => e.id).sort((a, b) => a - b).join(',')
}

export async function fetchNotificaciones(rol: string): Promise<NotificacionesPayload> {
  const alertas: AlertaNotificacion[] = []

  const esComprasOSupervisor = rol === 'compras' || rol === 'supervisor'

  const [productos, ajustesCount, eventosHoy, ordenesPendientes, mensajes] = await Promise.all([
    fetchProductosBajoStock(15),
    rol === 'supervisor' ? fetchAjustesPendientesCount().catch(() => 0) : Promise.resolve(0),
    fetchEventosHoy().catch(() => []),
    esComprasOSupervisor ? fetchOrdenesCompraPendientes().catch(() => []) : Promise.resolve([]),
    fetchMensajesInternos(),
  ])

  if (productos.length > 0) {
    alertas.push({
      tipo: 'stock_bajo',
      id: 'stock-bajo',
      firma: firmaStockBajo(productos),
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
      firma: firmaAjustes(ajustesCount),
      titulo: 'Ajustes pendientes',
      resumen: `${ajustesCount} solicitud${ajustesCount === 1 ? '' : 'es'} esperando tu aprobación`,
      href: '/ajustes',
      cantidad: ajustesCount,
    })
  }

  if (ordenesPendientes.length > 0) {
    alertas.push({
      tipo: 'ordenes_compra',
      id: 'ordenes-compra',
      firma: firmaOrdenesCompra(ordenesPendientes),
      titulo: 'Órdenes de compra pendientes',
      resumen: `${ordenesPendientes.length} orden${ordenesPendientes.length === 1 ? '' : 'es'} por cargar en Siigo`,
      href: '/compras',
      ordenes: ordenesPendientes.map((o) => ({
        id: o.id,
        codigo_producto: o.codigo_producto ?? o.items[0]?.codigo_producto ?? '—',
        descripcion: o.descripcion ?? o.items[0]?.descripcion ?? o.titulo ?? '—',
        cantidad: o.cantidad ?? o.items[0]?.cantidad ?? 0,
        fecha_pedido: o.fecha_pedido,
      })),
    })
  }

  if (eventosHoy.length > 0) {
    alertas.push({
      tipo: 'eventos_hoy',
      id: 'eventos-hoy',
      firma: firmaEventosHoy(eventosHoy),
      titulo: 'Eventos de hoy',
      resumen: `${eventosHoy.length} evento${eventosHoy.length === 1 ? '' : 's'} programado${eventosHoy.length === 1 ? '' : 's'} para hoy`,
      href: '/',
      eventos: eventosHoy.map((e) => ({
        id: e.id,
        titulo: e.titulo,
        fecha: e.fecha,
        fecha_fin: e.fecha_fin,
        nota: e.nota,
      })),
    })
  }

  const mensajesNoLeidos = mensajes.filter((m) => !m.leido).length
  const leidas = await fetchAlertasLeidas(alertas)

  return {
    alertas,
    mensajes,
    totalSinLeer: alertas.length + mensajesNoLeidos - leidas.length,
    leidas,
  }
}

async function fetchAlertasLeidas(alertas: AlertaNotificacion[]): Promise<string[]> {
  if (alertas.length === 0 || isDevBypassActive()) return []

  const user = await getSessionUser()
  if (!user) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notificaciones_leidas')
    .select('categoria, firma')
    .in('categoria', alertas.map((a) => a.id))

  if (error) return []

  const firmaLeidaPorCategoria = new Map((data ?? []).map((r) => [r.categoria, r.firma]))
  return alertas.filter((a) => firmaLeidaPorCategoria.get(a.id) === a.firma).map((a) => a.id)
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

// Las alertas son agregados sintéticos por categoría (stock_bajo,
// ajustes_pendientes, ordenes_compra, eventos_hoy), recalculados en cada
// fetchNotificaciones — no hay un id de fila real que marcar como leído.
// Por eso cada llamada manda también la `firma` (ids ordenados del
// contenido actual, calculada arriba): migración 049 guarda (usuario,
// categoria) -> firma, y una alerta solo se ve como leída si su firma
// actual coincide con la última que se marcó. Si el contenido cambió desde
// entonces, vuelve a aparecer como no leída aunque la categoría sea la misma.
export async function marcarNotificacionLeida(
  alertaId: string,
  firma: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isDevBypassActive()) return { ok: true }
  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sin sesión.' }
  const supabase = await createClient()
  const { error } = await supabase.from('notificaciones_leidas').upsert({
    usuario_id: user.id,
    categoria: alertaId,
    firma,
    leida_at: new Date().toISOString(),
  })
  if (error) return { ok: false, error: 'No se pudo marcar como leída.' }
  return { ok: true }
}

export async function marcarTodasLeidas(
  alertas: { id: string; firma: string }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isDevBypassActive()) return { ok: true }
  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sin sesión.' }
  const supabase = await createClient()
  const filas = alertas.map((a) => ({
    usuario_id: user.id,
    categoria: a.id,
    firma: a.firma,
    leida_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('notificaciones_leidas').upsert(filas)
  if (error) return { ok: false, error: 'No se pudieron marcar como leídas.' }
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
