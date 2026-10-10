'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import type { SiigoValidacionResultado } from '@/lib/types/siigo'

export async function validarSiigoOrdenCompra(datos: {
  codigo_producto: string
  proveedor_nit?: string
}): Promise<SiigoValidacionResultado> {
  const codigo = datos.codigo_producto?.trim()
  if (!codigo) {
    return { ok: false, error: 'Código de producto requerido.' }
  }

  if (isDevBypassActive()) {
    await new Promise((r) => setTimeout(r, 500))
    const nit = datos.proveedor_nit?.trim()
    return {
      ok: true,
      producto: { encontrado: true, code: codigo, name: 'Producto demo Siigo', active: true },
      proveedor: nit
        ? { encontrado: true, identification: nit, name: 'Proveedor demo Siigo', active: true }
        : null,
    }
  }

  const user = await getSessionUser()
  if (!user) {
    return { ok: false, error: 'Sesión expirada.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('siigo-validar', {
    body: {
      codigo_producto: codigo,
      proveedor_nit: datos.proveedor_nit?.trim() || undefined,
    },
  })

  if (error) {
    console.error('Failed to invoke siigo-validar:', error)
    return { ok: false, error: 'No se pudo conectar con Siigo. Revisa los secrets y vuelve a intentar.' }
  }

  const payload = data as SiigoValidacionResultado & { error?: string }
  if (!payload?.ok && payload?.error) {
    return { ok: false, error: payload.error }
  }

  return payload
}
