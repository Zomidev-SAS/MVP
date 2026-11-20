'use server'

import { requireRole } from '@/lib/auth/require-role'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { CONFIG_DESEMPENO_DEFAULT, type ConfigDesempeno } from '@/lib/proveedores/desempeno'
import { esMigracionPendiente } from '@/lib/proveedores/errores'
import { createClient } from '@/lib/supabase/server'
import { configAColumnas, leerConfigDesempeno } from '@/lib/supabase/proveedor-config'
import { configDesempenoSchema, type DesempenoResultado } from '@/lib/types/proveedor-desempeno'

export async function fetchConfigDesempeno(): Promise<ConfigDesempeno> {
  if (isDevBypassActive()) return CONFIG_DESEMPENO_DEFAULT

  const auth = await requireRole(ROUTE_PERMISSIONS.proveedores)
  if (!auth.ok) return CONFIG_DESEMPENO_DEFAULT

  const supabase = await createClient()
  return leerConfigDesempeno(supabase)
}

export async function actualizarConfigDesempeno(input: ConfigDesempeno): Promise<DesempenoResultado> {
  const parsed = configDesempenoSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.configuracion)
  if (!auth.ok) return { ok: false, error: 'Solo el supervisor puede cambiar la evaluación.' }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return { ok: true }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('config_app').update(configAColumnas(parsed.data)).eq('id', 1)

  if (error) {
    if (esMigracionPendiente(error)) {
      return { ok: false, error: 'Falta aplicar la migración 081 en Supabase.' }
    }
    console.error('Failed to update proveedor config:', error)
    return { ok: false, error: 'No se pudo guardar la configuración.' }
  }

  return { ok: true }
}
