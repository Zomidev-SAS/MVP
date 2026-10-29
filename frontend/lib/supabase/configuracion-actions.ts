'use server'

import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import {
  configuracionSchema,
  umbralesCategoriaSchema,
  type UmbralCategoria,
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

const CATEGORIAS_DEV = ['TORNILLERIA', 'PERFILERIA', 'FIBRA', 'ELECTRICOS']

export async function fetchUmbralesCategoria(): Promise<UmbralCategoria[]> {
  if (isDevBypassActive()) {
    return CATEGORIAS_DEV.map((categoria) => ({
      categoria,
      umbral: categoria === 'TORNILLERIA' ? 100 : null,
    }))
  }

  const supabase = await createClient()
  const [categorias, umbrales] = await Promise.all([
    supabase.from('categorias_inventario').select('nombre').order('nombre'),
    supabase.from('umbrales_categoria').select('categoria, umbral'),
  ])

  if (categorias.error || umbrales.error) {
    console.error('Failed to load umbrales por categoria:', categorias.error ?? umbrales.error)
    return []
  }

  const porCategoria = new Map((umbrales.data ?? []).map((u) => [u.categoria, u.umbral as number]))
  return (categorias.data ?? []).map((c) => ({
    categoria: c.nombre,
    umbral: porCategoria.get(c.nombre) ?? null,
  }))
}

export async function guardarUmbralesCategoria(
  datos: UmbralCategoria[]
): Promise<ConfiguracionResultado> {
  const parsed = umbralesCategoriaSchema.safeParse(datos)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos. Cada umbral debe ser 0 o mayor.' }
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
  const conUmbral = parsed.data.filter((d) => d.umbral !== null)
  const sinUmbral = parsed.data.filter((d) => d.umbral === null).map((d) => d.categoria)

  if (conUmbral.length > 0) {
    const { error } = await supabase
      .from('umbrales_categoria')
      .upsert(
        conUmbral.map((d) => ({
          categoria: d.categoria,
          umbral: d.umbral as number,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'categoria' }
      )
    if (error) {
      console.error('Failed to save umbrales_categoria:', error)
      return { ok: false, error: 'No se pudieron guardar los umbrales. Intenta de nuevo.' }
    }
  }

  if (sinUmbral.length > 0) {
    const { error } = await supabase.from('umbrales_categoria').delete().in('categoria', sinUmbral)
    if (error) {
      console.error('Failed to clear umbrales_categoria:', error)
      return { ok: false, error: 'No se pudieron quitar algunos umbrales. Intenta de nuevo.' }
    }
  }

  return { ok: true }
}
