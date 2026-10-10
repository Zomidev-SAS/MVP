'use server'

import { createClient } from '@/lib/supabase/server'
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
  if (isDevBypassActive()) return
  const supabase = await createClient()
  // NOTA: función/edge function de reenvío a confirmar en contrato (probablemente supabase.functions.invoke('reenviar-correo', { body: { id } }))
  const { error } = await supabase.functions.invoke('reenviar-correo', { body: { id } })
  if (error) throw new Error(`No se pudo reenviar el correo: ${error.message}`)
}

export async function previsualizarEnvio(rol: Role): Promise<EnvioPreview> {
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
