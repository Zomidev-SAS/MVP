'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { PREVIEW_CORREOS } from '@/lib/dev/preview-correos-data'
import type { CorreoEnviado, EnvioPreview, EstadoCorreo, OrigenCorreo } from '@/lib/types/correos'
import type { Role } from '@/lib/types/database'

// cola_correos (docs/CONTRATO_DATOS_SECCION2.md, sección 8) no es
// `vista_correos_enviados` como se asumió antes del contrato: tiene su
// propio set de estados y no trae nombre/rol del destinatario (solo
// `usuario_id`), así que se junta con vista_usuarios_panel.
const ESTADOS_POR_FILTRO: Record<EstadoCorreo, string[]> = {
  pendiente: ['pendiente', 'enviando'],
  enviado: ['enviado', 'agrupado'],
  error: ['error'],
}

function estadoFrontend(estadoBackend: string): EstadoCorreo {
  if (estadoBackend === 'enviando') return 'pendiente'
  if (estadoBackend === 'agrupado') return 'enviado'
  return estadoBackend as EstadoCorreo
}

function origenFrontend(origenBackend: string): OrigenCorreo {
  return origenBackend.startsWith('mensaje_panel:') ? 'mensaje' : 'alerta'
}

interface FilaColaCorreo {
  id: number
  destinatario: string
  usuario_id: string | null
  tipo: string
  asunto: string
  origen: string
  estado: string
  error: string | null
  enviado_at: string | null
  created_at: string
}

export async function fetchCorreosEnviados(filtros?: { estado?: EstadoCorreo }): Promise<CorreoEnviado[]> {
  if (isDevBypassActive()) {
    return filtros?.estado ? PREVIEW_CORREOS.filter((c) => c.estado === filtros.estado) : PREVIEW_CORREOS
  }

  const supabase = await createClient()
  let query = supabase
    .from('cola_correos')
    .select('id, destinatario, usuario_id, tipo, asunto, origen, estado, error, enviado_at, created_at')
    .order('created_at', { ascending: false })
  if (filtros?.estado) query = query.in('estado', ESTADOS_POR_FILTRO[filtros.estado])

  const { data, error } = await query
  if (error) throw new Error(`No se pudieron cargar los correos: ${error.message}`)

  const filas = (data ?? []) as FilaColaCorreo[]
  const usuarioIds = Array.from(new Set(filas.map((f) => f.usuario_id).filter((id): id is string => id !== null)))

  const perfilPorId = new Map<string, { nombre: string; rol: string }>()
  if (usuarioIds.length > 0) {
    const { data: perfiles } = await supabase
      .from('vista_usuarios_panel')
      .select('id, nombre, rol')
      .in('id', usuarioIds)
    for (const p of perfiles ?? []) perfilPorId.set(p.id, { nombre: p.nombre, rol: p.rol })
  }

  return filas.map((f) => ({
    id: String(f.id),
    destinatarioEmail: f.destinatario,
    destinatarioNombre: (f.usuario_id && perfilPorId.get(f.usuario_id)?.nombre) ?? f.destinatario,
    rolDestino: (f.usuario_id && perfilPorId.get(f.usuario_id)?.rol) ?? '',
    asunto: f.asunto,
    origen: origenFrontend(f.origen),
    estado: estadoFrontend(f.estado),
    fechaEnvio: f.enviado_at,
    error: f.error,
    creadoEn: f.created_at,
  }))
}

export async function reenviarCorreo(id: string): Promise<void> {
  // Este archivo es 'use server': el Server Action ID de esta función SÍ se
  // expone al bundle del cliente porque la importa un Client Component
  // (CorreosTable.tsx). La UI solo renderiza el botón "Reenviar" para
  // supervisor, pero eso es un gate de UI nada más — sin este chequeo,
  // cualquier usuario autenticado podría invocar la acción directamente.
  // rpc_reenviar_correo (migración 049) vuelve a validar el rol del lado del
  // backend de todas formas.
  const auth = await requireRole(['supervisor'])
  if (!auth.ok) throw new Error(auth.error)
  if (isDevBypassActive()) return
  const supabase = await createClient()
  const { error } = await supabase.rpc('rpc_reenviar_correo', { p_id: Number(id) })
  if (error) throw new Error(`No se pudo reenviar el correo: ${error.message}`)
}

export async function previsualizarEnvio(rol: Role): Promise<EnvioPreview> {
  // Mismo motivo que reenviarCorreo: el Server Action ID se expone al
  // cliente vía EnvioCorreoPreview.tsx, así que sin este chequeo cualquier
  // usuario autenticado (incluido `comercial`/`lectura`) podría contar
  // usuarios por rol.
  const auth = await requireRole(['supervisor'])
  if (!auth.ok) throw new Error(auth.error)
  if (isDevBypassActive()) return { rol, totalDestinatarios: 5 }
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('vista_usuarios_panel')
    .select('*', { count: 'exact', head: true })
    .eq('rol', rol)
    .eq('activo', true)
  if (error) throw new Error(`No se pudo calcular destinatarios: ${error.message}`)
  return { rol, totalDestinatarios: count ?? 0 }
}
