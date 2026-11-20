'use server'

import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import {
  configuracionSchema,
  umbralCategoriaSchema,
  type UmbralesCategoriaData,
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

const CATEGORIAS_DEV = ['TORNILLERIA', 'PERFILERIA', 'FIBRA', 'ELECTRICOS', 'MECANIZADOS']

export async function fetchUmbralesCategoria(): Promise<UmbralesCategoriaData> {
  if (isDevBypassActive()) {
    return {
      categorias: CATEGORIAS_DEV,
      umbrales: [{ categoria: 'TORNILLERIA', umbral: 100, en_alerta: 12 }],
      error: null,
    }
  }

  const supabase = await createClient()
  const [categorias, umbrales, enAlerta] = await Promise.all([
    supabase.from('categorias_inventario').select('nombre').order('nombre'),
    supabase.from('umbrales_categoria').select('categoria, umbral').order('categoria'),
    supabase.from('vista_stock_bajo').select('categoria'),
  ])

  if (categorias.error || umbrales.error) {
    const detalle = (umbrales.error ?? categorias.error)?.message ?? 'error desconocido'
    console.error('Failed to load umbrales por categoria:', categorias.error ?? umbrales.error)
    return {
      categorias: (categorias.data ?? []).map((c) => c.nombre),
      umbrales: [],
      error: `No se pudieron cargar los umbrales (${detalle}). Si es la primera vez, falta aplicar la migración 072 en Supabase.`,
    }
  }

  // Si vista_stock_bajo aún no existe solo se pierde el contador de productos en alerta.
  const conteo = new Map<string, number>()
  for (const fila of enAlerta.data ?? []) {
    if (fila.categoria) conteo.set(fila.categoria, (conteo.get(fila.categoria) ?? 0) + 1)
  }

  return {
    categorias: (categorias.data ?? []).map((c) => c.nombre),
    umbrales: (umbrales.data ?? []).map((u) => ({
      categoria: u.categoria,
      umbral: u.umbral as number,
      en_alerta: conteo.get(u.categoria) ?? 0,
    })),
    error: null,
  }
}

export async function guardarUmbralCategoria(
  categoria: string,
  umbral: number
): Promise<ConfiguracionResultado> {
  const parsed = umbralCategoriaSchema.safeParse({ categoria, umbral })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 300))
    return { ok: true }
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.configuracion)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('umbrales_categoria')
    .upsert(
      { categoria: parsed.data.categoria, umbral: parsed.data.umbral, updated_at: new Date().toISOString() },
      { onConflict: 'categoria' }
    )

  if (error) {
    console.error('Failed to save umbrales_categoria:', error)
    return { ok: false, error: 'No se pudo guardar el umbral. Intenta de nuevo.' }
  }

  return { ok: true }
}

export async function quitarUmbralCategoria(categoria: string): Promise<ConfiguracionResultado> {
  if (!categoria) {
    return { ok: false, error: 'Elige una categoría.' }
  }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 300))
    return { ok: true }
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.configuracion)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('umbrales_categoria').delete().eq('categoria', categoria)

  if (error) {
    console.error('Failed to delete umbrales_categoria:', error)
    return { ok: false, error: 'No se pudo quitar el umbral. Intenta de nuevo.' }
  }

  return { ok: true }
}
