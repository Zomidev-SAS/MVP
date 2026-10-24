'use server'

import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getDevPreviewFormulariosData } from '@/lib/dev/preview-formularios-data'
import { normalizarFormularios } from '@/lib/formularios/normalize'
import { normalizarTextoBusqueda } from '@/lib/formularios/busqueda'
import { vistaFormulario, type FormularioListado } from '@/lib/types/formularios'
import {
  construirEventosLineaTiempo,
  extraerSugerenciasVehiculo,
  listarVehiculosRecientes,
  type EventoLineaTiempo,
  type VehiculoSugerencia,
} from '@/lib/formularios/linea-tiempo'

const MAX_FORMULARIOS_CARGA = 2000

async function cargarFormularios(): Promise<FormularioListado[]> {
  if (isDevBypassActive()) {
    return getDevPreviewFormulariosData()
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.formularios)
  if (!auth.ok) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('formularios')
    .select('*')
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(MAX_FORMULARIOS_CARGA)

  if (error) {
    console.error('Failed to load formularios for vehicle timeline:', error)
    return []
  }

  return normalizarFormularios(data)
}

export async function buscarVehiculosFormulario(
  termino: string,
  limite = 40
): Promise<VehiculoSugerencia[]> {
  const filas = await cargarFormularios()
  return extraerSugerenciasVehiculo(filas, termino, limite)
}

export async function fetchVehiculosRecientes(limite = 30): Promise<VehiculoSugerencia[]> {
  const filas = await cargarFormularios()
  return listarVehiculosRecientes(filas, limite)
}

export async function fetchLineaTiempoVehiculo(chasis: string): Promise<EventoLineaTiempo[]> {
  const chasisNorm = normalizarTextoBusqueda(chasis)
  if (!chasisNorm) return []

  const filas = await cargarFormularios()
  const filasDelVehiculo = filas.filter(
    (fila) => normalizarTextoBusqueda(vistaFormulario(fila).chasis) === chasisNorm
  )

  return construirEventosLineaTiempo(filasDelVehiculo)
}
