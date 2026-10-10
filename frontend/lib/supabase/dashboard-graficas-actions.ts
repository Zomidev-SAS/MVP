'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { PREVIEW_DASHBOARD_GRAFICAS } from '@/lib/dev/preview-dashboard-graficas-data'
import { CAN_VIEW_COSTS } from '@/lib/permissions/roles'
import type { Role } from '@/lib/types/database'
import type { DashboardFiltros, DashboardGraficasPayload } from '@/lib/types/dashboard-graficas'

export async function fetchDashboardGraficas(
  rol: Role,
  filtros: DashboardFiltros
): Promise<DashboardGraficasPayload> {
  const puedeVerCostos = CAN_VIEW_COSTS.includes(rol)

  if (isDevBypassActive()) {
    return {
      ...PREVIEW_DASHBOARD_GRAFICAS,
      valorizacion: puedeVerCostos ? PREVIEW_DASHBOARD_GRAFICAS.valorizacion : null,
    }
  }

  const supabase = await createClient()

  // NOTA: nombres de vista/RPC a confirmar con el contrato de datos del viernes 12:00 m.
  // Mientras tanto, placeholder que falla explícito en vez de silencioso.
  const { data, error } = await supabase.rpc('dashboard_graficas', {
    p_rango: filtros.rango,
    p_desde: filtros.desde ?? null,
    p_hasta: filtros.hasta ?? null,
    p_bodega_id: filtros.bodegaId ?? null,
    p_categoria_id: filtros.categoriaId ?? null,
  })

  if (error) throw new Error(`No se pudo cargar dashboard_graficas: ${error.message}`)

  const payload = data as DashboardGraficasPayload
  return { ...payload, valorizacion: puedeVerCostos ? payload.valorizacion : null }
}
