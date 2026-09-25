'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { ROUTE_PERMISSIONS, ROLES_PROCESO_VEHICULO } from '@/lib/permissions/roles'
import { getDevPreviewProcesosVehiculo } from '@/lib/dev/preview-procesos-vehiculo-data'
import {
  guardarProcesoVehiculoSchema,
  type GuardarProcesoVehiculoInput,
  type ProcesoVehiculoResultado,
  type VehiculoProceso,
} from '@/lib/types/vehiculo-proceso'

type ProcesoRow = {
  id: string
  chasis: string
  titulo: string
  proceso_estado: string
  observaciones: string | null
  seccion_siguiente: string | null
  creado_por_nombre: string | null
  creado_en: string
}

function mapProceso(row: ProcesoRow): VehiculoProceso {
  return {
    id: row.id,
    chasis: row.chasis,
    titulo: row.titulo,
    procesoEstado: row.proceso_estado,
    observaciones: row.observaciones,
    seccionSiguiente: row.seccion_siguiente,
    creadoPorNombre: row.creado_por_nombre,
    creadoEn: row.creado_en,
  }
}

export async function fetchProcesosVehiculo(chasis: string): Promise<VehiculoProceso[]> {
  if (!chasis.trim()) return []

  if (isDevBypassActive()) {
    return getDevPreviewProcesosVehiculo(chasis)
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.formularios)
  if (!auth.ok) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehiculo_procesos')
    .select(
      'id, chasis, titulo, proceso_estado, observaciones, seccion_siguiente, creado_por_nombre, creado_en'
    )
    .eq('chasis', chasis)
    .order('creado_en', { ascending: true })

  if (error) {
    console.error('Failed to load vehiculo_procesos:', error)
    return []
  }

  return (data ?? []).map(mapProceso)
}

export async function crearProcesoVehiculo(
  input: GuardarProcesoVehiculoInput
): Promise<ProcesoVehiculoResultado> {
  const parsed = guardarProcesoVehiculoSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos. Revisa el formulario.' }
  }

  const auth = await requireRole(ROLES_PROCESO_VEHICULO)
  if (!auth.ok) {
    return { ok: false, error: 'No autorizado para agregar procesos.' }
  }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return { ok: true }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('vehiculo_procesos').insert({
    chasis: parsed.data.chasis,
    titulo: parsed.data.titulo,
    proceso_estado: parsed.data.procesoEstado,
    observaciones: parsed.data.observaciones.trim() || null,
    seccion_siguiente: parsed.data.seccionSiguiente.trim() || null,
  })

  if (error) {
    console.error('Failed to insert vehiculo_proceso:', error)
    return { ok: false, error: 'No se pudo guardar el proceso.' }
  }

  return { ok: true }
}
