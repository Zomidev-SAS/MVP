'use server'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { entradaSchema, type EntradaInput } from '@/lib/types/entradas'
import type { ImportarResultado } from '@/lib/types/importar'

export async function crearEntradasMasivas(filas: EntradaInput[]): Promise<ImportarResultado> {
  const validas = filas.filter((fila) => entradaSchema.safeParse(fila).success)

  if (validas.length === 0) {
    return { ok: false, error: 'No hay filas válidas para importar.' }
  }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 800))
    return { ok: true, insertados: validas.length }
  }

  const user = await getSessionUser()
  if (!user) {
    return { ok: false, error: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const supabase = await createClient()

  const filasParaInsertar = validas.map((fila) => ({
    vin: fila.vin,
    marca: fila.marca,
    categoria: fila.categoria,
    cantidad: fila.cantidad,
    valor_unitario: fila.valor_unitario ?? null,
    ubicacion: fila.ubicacion,
    motivo: fila.notas ?? null,
    tipo_movimiento: 'entrada' as const,
    estado: 'aplicado' as const,
    actor_id: user.id,
  }))

  const { error } = await supabase.from('movimientos_inventario').insert(filasParaInsertar)

  if (error) {
    console.error('Failed to insert entradas masivas:', error)
    return { ok: false, error: 'No se pudo importar. Intenta de nuevo.' }
  }

  return { ok: true, insertados: validas.length }
}
