'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
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
      kpis: puedeVerCostos
        ? PREVIEW_DASHBOARD_GRAFICAS.kpis
        : PREVIEW_DASHBOARD_GRAFICAS.kpis.filter((k) => k.unidad !== 'cop'),
    }
  }

  // Seguridad: este archivo es 'use server', así que cualquier cliente puede invocar
  // esta acción con un `rol` falsificado. Por eso el permiso de costos se decide con el
  // rol de la sesión real (resuelto en el servidor), nunca con el parámetro `rol`.
  const sesion = await getCurrentProfile()
  if (sesion.status !== 'authenticated') throw new Error('Sesión no válida')
  const puedeVerCostosReal = CAN_VIEW_COSTS.includes(sesion.profile.rol)

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

  if (error || !data) {
    throw new Error(
      `No se pudo cargar dashboard_graficas: ${error?.message ?? 'respuesta vacía'}`
    )
  }

  const payload = data as DashboardGraficasPayload
  return {
    ...payload,
    valorizacion: puedeVerCostosReal ? payload.valorizacion : null,
    kpis: puedeVerCostosReal ? payload.kpis : payload.kpis.filter((k) => k.unidad !== 'cop'),
  }
}
