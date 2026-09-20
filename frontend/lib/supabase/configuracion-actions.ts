'use server'

import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import {
  configuracionSchema,
  type Configuracion,
  type ConfiguracionInput,
  type ConfiguracionResultado,
} from '@/lib/types/configuracion'

const CONFIGURACION_DEFAULT: Configuracion = {
  bloquear_sin_stock: false,
  umbral_stock_bajo: 2,
}

export async function fetchConfiguracion(): Promise<Configuracion> {
  if (isDevBypassActive()) {
    return CONFIGURACION_DEFAULT
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('config_app')
    .select('bloquear_sin_stock, umbral_stock_bajo')
    .eq('id', 1)
    .maybeSingle()

  if (error || !data) {
    console.error('Failed to load config_app:', error)
    return CONFIGURACION_DEFAULT
  }

  return data
}

export async function actualizarConfiguracion(
  datos: ConfiguracionInput
): Promise<ConfiguracionResultado> {
  const parsed = configuracionSchema.safeParse(datos)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos. Revisa el formulario.' }
  }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return { ok: true }
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.configuracion)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('config_app')
    .update({
      bloquear_sin_stock: parsed.data.bloquear_sin_stock,
      umbral_stock_bajo: parsed.data.umbral_stock_bajo,
    })
    .eq('id', 1)

  if (error) {
    console.error('Failed to update config_app:', error)
    return { ok: false, error: 'No se pudo guardar la configuración. Intenta de nuevo.' }
  }

  return { ok: true }
}
