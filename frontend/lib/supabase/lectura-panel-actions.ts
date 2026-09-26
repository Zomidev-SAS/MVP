'use server'

import { requireRole } from '@/lib/auth/require-role'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewFormulariosData } from '@/lib/dev/preview-formularios-data'
import { normalizarFormularios } from '@/lib/formularios/normalize'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { createClient } from '@/lib/supabase/server'
import {
  esFormularioEntrada,
  esFormularioSalida,
  vistaFormulario,
} from '@/lib/types/formularios'
import type { EntradaSalidaDia } from '@/lib/types/dashboard'

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function bogotaDateKey(isoString: string): string {
  const bogotaMs = new Date(isoString).getTime() + BOGOTA_OFFSET_MS
  return new Date(bogotaMs).toISOString().slice(0, 10)
}

function getBogotaTodayStart(): Date {
  const bogotaMs = Date.now() + BOGOTA_OFFSET_MS
  const bogotaDateStr = new Date(bogotaMs).toISOString().slice(0, 10)
  return new Date(`${bogotaDateStr}T00:00:00-05:00`)
}

function buildSerie(desde: Date, conteos: Map<string, { entradas: number; salidas: number }>): EntradaSalidaDia[] {
  const serie: EntradaSalidaDia[] = []
  for (let i = 0; i < 7; i++) {
    const dia = new Date(desde.getTime() + i * DAY_MS)
    const key = bogotaDateKey(dia.toISOString())
    const bucket = conteos.get(key) ?? { entradas: 0, salidas: 0 }
    serie.push({ fecha: key, entradas: bucket.entradas, salidas: bucket.salidas })
  }
  return serie
}

/** Entradas vs salidas de vehículos (formularios), sin datos de inventario. */
export async function fetchEntradasSalidasFormulariosSemana(): Promise<EntradaSalidaDia[]> {
  const todayStart = getBogotaTodayStart()
  const sevenDaysAgo = new Date(todayStart.getTime() - 6 * DAY_MS)

  if (isDevBypassActive()) {
    const filas = getDevPreviewFormulariosData()
    const conteos = new Map<string, { entradas: number; salidas: number }>()
    for (const fila of filas) {
      const vista = vistaFormulario(fila)
      const ref = vista.fechaIngreso ?? vista.fechaSalida ?? fila.created_at
      if (!ref) continue
      const key = bogotaDateKey(ref)
      if (key < bogotaDateKey(sevenDaysAgo.toISOString())) continue
      const bucket = conteos.get(key) ?? { entradas: 0, salidas: 0 }
      if (esFormularioEntrada(fila.tipo)) bucket.entradas += 1
      else if (esFormularioSalida(fila.tipo)) bucket.salidas += 1
      conteos.set(key, bucket)
    }
    return buildSerie(sevenDaysAgo, conteos)
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.formularios)
  if (!auth.ok) return buildSerie(sevenDaysAgo, new Map())

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('formularios')
    .select('tipo, data, created_at')
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(3000)

  if (error) {
    console.error('Failed to load formularios for lectura chart:', error)
    return buildSerie(sevenDaysAgo, new Map())
  }

  const filas = normalizarFormularios(data)
  const conteos = new Map<string, { entradas: number; salidas: number }>()

  for (const fila of filas) {
    const vista = vistaFormulario(fila)
    const ref = vista.fechaIngreso ?? vista.fechaSalida ?? fila.created_at
    if (!ref) continue
    const key = bogotaDateKey(ref)
    const bucket = conteos.get(key) ?? { entradas: 0, salidas: 0 }
    if (esFormularioEntrada(fila.tipo)) bucket.entradas += 1
    else if (esFormularioSalida(fila.tipo)) bucket.salidas += 1
    conteos.set(key, bucket)
  }

  return buildSerie(sevenDaysAgo, conteos)
}
