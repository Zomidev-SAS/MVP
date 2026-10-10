'use server'

import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
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

  const auth = await requireRole(ROUTE_PERMISSIONS.entradas)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
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
    actor_id: auth.user.id,
  })

  if (error) {
    console.error('Failed to insert entrada:', error)
    return { ok: false, error: 'No se pudo registrar la entrada. Intenta de nuevo.' }
  }

  return { ok: true }
}
