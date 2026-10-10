'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { PREVIEW_CORREOS } from '@/lib/dev/preview-correos-data'
import type { CorreoEnviado, EnvioPreview, EstadoCorreo } from '@/lib/types/correos'
import type { Role } from '@/lib/types/database'

export async function fetchCorreosEnviados(filtros?: { estado?: EstadoCorreo }): Promise<CorreoEnviado[]> {
  if (isDevBypassActive()) {
    return filtros?.estado ? PREVIEW_CORREOS.filter((c) => c.estado === filtros.estado) : PREVIEW_CORREOS
  }
  const supabase = await createClient()
  // NOTA: vista `vista_correos_enviados` a confirmar en contrato del backend — aún no existe.
  let query = supabase.from('vista_correos_enviados').select('*').order('creado_en', { ascending: false })
  if (filtros?.estado) query = query.eq('estado', filtros.estado)
  const { data, error } = await query
  if (error) throw new Error(`No se pudieron cargar los correos: ${error.message}`)
  return data as CorreoEnviado[]
}

export async function reenviarCorreo(id: string): Promise<void> {
  // Este archivo es 'use server': el Server Action ID de esta función SÍ se
  // expone al bundle del cliente porque la importa un Client Component
  // (CorreosTable.tsx). La UI solo renderiza el botón "Reenviar" para
  // supervisor, pero eso es un gate de UI nada más — sin este chequeo,
  // cualquier usuario autenticado podría invocar la acción directamente.
  const auth = await requireRole(['supervisor'])
  if (!auth.ok) throw new Error(auth.error)
  if (isDevBypassActive()) return
  const supabase = await createClient()
  // NOTA: función/edge function de reenvío a confirmar en contrato (probablemente supabase.functions.invoke('reenviar-correo', { body: { id } }))
  const { error } = await supabase.functions.invoke('reenviar-correo', { body: { id } })
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
  // NOTA: vista `vista_usuarios_panel` a confirmar en contrato del backend — aún no existe.
  const { count, error } = await supabase
    .from('vista_usuarios_panel')
    .select('*', { count: 'exact', head: true })
    .eq('rol', rol)
    .eq('activo', true)
  if (error) throw new Error(`No se pudo calcular destinatarios: ${error.message}`)
  return { rol, totalDestinatarios: count ?? 0 }
}
