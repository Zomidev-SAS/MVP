'use server'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { entradaSchema, type EntradaInput, type EntradaResultado } from '@/lib/types/entradas'

export async function crearEntrada(datos: EntradaInput): Promise<EntradaResultado> {
  const parsed = entradaSchema.safeParse(datos)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos. Revisa el formulario.' }
  }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { ok: true }
  }

  const user = await getSessionUser()
  if (!user) {
    return { ok: false, error: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('movimientos_inventario').insert({
    codigo_producto: parsed.data.codigo_producto,
    tipo_movimiento: 'entrada',
    estado: 'aplicado',
    cantidad: parsed.data.cantidad,
    valor_unitario: parsed.data.valor_unitario ?? null,
    bodega: parsed.data.bodega,
    motivo: parsed.data.motivo ?? null,
    actor_id: user.id,
  })

  if (error) {
    console.error('Failed to insert entrada:', error)
    return { ok: false, error: 'No se pudo registrar la entrada. Intenta de nuevo.' }
  }

  return { ok: true }
}
