'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import type { NotaPersonal } from '@/lib/types/notas'

const notaSchema = z.object({
  contenido: z.string().trim().min(1, 'Escribe algo en la nota.'),
})

export async function fetchNotas(): Promise<NotaPersonal[]> {
  if (isDevBypassActive()) {
    return [
      { id: 1, contenido: 'Revisar pedido de tornillería', created_at: new Date().toISOString() },
      { id: 2, contenido: 'Llamar a proveedor maderas', created_at: new Date().toISOString() },
    ]
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notas_personales')
    .select('id, contenido, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Failed to load notas_personales:', error)
    return []
  }

  return data ?? []
}

export async function crearNota(contenido: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = notaSchema.safeParse({ contenido })
  if (!parsed.success) {
    return { ok: false, error: 'Escribe algo en la nota.' }
  }

  if (isDevBypassActive()) {
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sin sesión.' }

  const supabase = await createClient()
  const { error } = await supabase.from('notas_personales').insert({
    usuario_id: user.id,
    contenido: parsed.data.contenido,
  })

  if (error) {
    console.error('Failed to create nota:', error)
    return { ok: false, error: 'No se pudo guardar la nota.' }
  }

  return { ok: true }
}

export async function eliminarNota(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isDevBypassActive()) {
    return { ok: true }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('notas_personales').delete().eq('id', id)

  if (error) {
    return { ok: false, error: 'No se pudo borrar la nota.' }
  }

  return { ok: true }
}
