'use server'

import { requireRole } from '@/lib/auth/require-role'
import { getDevPreviewReevaluaciones } from '@/lib/dev/preview-proveedores-data'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { esMigracionPendiente } from '@/lib/proveedores/errores'
import { calcularReevaluacion, motivoObligatorio } from '@/lib/proveedores/reevaluacion'
import { createClient } from '@/lib/supabase/server'
import { leerConfigDesempeno } from '@/lib/supabase/proveedor-config'
import { cargarHistoriales } from '@/lib/supabase/proveedor-historial'
import { MIGRACION_PENDIENTE } from '@/lib/types/proveedor'
import {
  guardarReevaluacionSchema,
  type DetalleReevaluacion,
  type GuardarReevaluacionInput,
  type Reevaluacion,
  type ReevaluacionResultado,
} from '@/lib/types/proveedor-reevaluacion'

const MENSAJE_MIGRACION = 'Falta aplicar la migración 082 en Supabase para guardar la reevaluación.'

const SELECT_REEVALUACION =
  'id, proveedor_id, anio, porcentaje, umbral, resultado, motivo, detalle, creado_por_nombre, created_at, updated_at'

export async function fetchReevaluaciones(
  proveedorId: number
): Promise<{ reevaluaciones: Reevaluacion[]; error?: string }> {
  if (!Number.isInteger(proveedorId) || proveedorId <= 0) return { reevaluaciones: [] }

  if (isDevBypassActive()) {
    return { reevaluaciones: getDevPreviewReevaluaciones(proveedorId) }
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.proveedores)
  if (!auth.ok) return { reevaluaciones: [], error: auth.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proveedor_reevaluaciones')
    .select(SELECT_REEVALUACION)
    .eq('proveedor_id', proveedorId)
    .order('anio', { ascending: false })

  if (error) {
    if (esMigracionPendiente(error)) return { reevaluaciones: [], error: MIGRACION_PENDIENTE }
    console.error('Failed to load proveedor_reevaluaciones:', error)
    return { reevaluaciones: [], error: 'No se pudieron cargar las reevaluaciones.' }
  }

  return {
    reevaluaciones: ((data ?? []) as Reevaluacion[]).map((r) => ({
      ...r,
      porcentaje: Number(r.porcentaje),
      umbral: Number(r.umbral),
    })),
  }
}

/**
 * Guarda (o actualiza) la reevaluación del año. El porcentaje se recalcula aquí, en el servidor,
 * con las órdenes del año y la configuración vigente; el cliente solo envía la decisión.
 */
export async function guardarReevaluacion(
  proveedorId: number,
  input: GuardarReevaluacionInput
): Promise<ReevaluacionResultado> {
  const parsed = guardarReevaluacionSchema.safeParse(input)
  if (!parsed.success || !Number.isInteger(proveedorId) || proveedorId <= 0) {
    return { ok: false, error: 'Datos inválidos.' }
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.proveedores)
  if (!auth.ok) return { ok: false, error: auth.error }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    return { ok: true }
  }

  const supabase = await createClient()
  const config = await leerConfigDesempeno(supabase)

  const { data: proveedor, error: errorProveedor } = await supabase
    .from('proveedores')
    .select('id, nit_normalizado')
    .eq('id', proveedorId)
    .maybeSingle()
  if (errorProveedor || !proveedor) {
    return { ok: false, error: 'No se encontró el proveedor.' }
  }

  let filas
  try {
    const historiales = await cargarHistoriales(
      supabase,
      [proveedor as { id: number; nit_normalizado: string }],
      config
    )
    filas = historiales.get(proveedorId) ?? []
  } catch (fallo) {
    console.error('Failed to load historial for reevaluacion:', fallo)
    return { ok: false, error: 'No se pudo calcular la reevaluación.' }
  }

  const { anio, resultado, motivo } = parsed.data
  const calculo = calcularReevaluacion(filas, anio, config)
  if (calculo.porcentaje == null) {
    return { ok: false, error: `No hay órdenes finalizadas en ${anio} para reevaluar a este proveedor.` }
  }
  if (motivoObligatorio(resultado, calculo.porcentaje, config.umbral) && !motivo) {
    return { ok: false, error: 'Escribe el motivo de la decisión.' }
  }

  const detalle: DetalleReevaluacion = {
    total: calculo.total,
    calificadas: calculo.calificadas,
    promedios: calculo.promedios,
    conRetraso: calculo.conRetraso,
    devoluciones: calculo.devoluciones,
    diasRetrasoPromedio: calculo.diasRetrasoPromedio,
    pesos: config.pesos,
    penalizacionDia: config.penalizacionDia,
    penalizacionDevolucion: config.penalizacionDevolucion,
  }
  const datos = {
    porcentaje: calculo.porcentaje,
    umbral: config.umbral,
    resultado,
    motivo: motivo || null,
    detalle,
  }

  const { data: existente, error: errorBusqueda } = await supabase
    .from('proveedor_reevaluaciones')
    .select('id')
    .eq('proveedor_id', proveedorId)
    .eq('anio', anio)
    .maybeSingle()
  if (errorBusqueda) {
    if (esMigracionPendiente(errorBusqueda)) return { ok: false, error: MENSAJE_MIGRACION }
    console.error('Failed to look up reevaluacion:', errorBusqueda)
    return { ok: false, error: 'No se pudo guardar la reevaluación.' }
  }

  const { error } = existente
    ? await supabase
        .from('proveedor_reevaluaciones')
        .update(datos)
        .eq('id', (existente as { id: number }).id)
    : await supabase
        .from('proveedor_reevaluaciones')
        .insert({ ...datos, proveedor_id: proveedorId, anio })

  if (error) {
    if (esMigracionPendiente(error)) return { ok: false, error: MENSAJE_MIGRACION }
    console.error('Failed to save reevaluacion:', error)
    return { ok: false, error: 'No se pudo guardar la reevaluación.' }
  }

  return { ok: true }
}
