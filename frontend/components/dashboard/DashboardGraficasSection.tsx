import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import type { Role } from '@/lib/types/database'
import type { DashboardFiltros, DashboardGraficasPayload } from '@/lib/types/dashboard-graficas'
import type { DashboardVariante } from '@/lib/permissions/dashboard-variante'
import type { EntradaSalidaDia } from '@/lib/types/dashboard'
import { fetchDashboardGraficas } from '@/lib/supabase/dashboard-graficas-actions'
import { EmptyState } from '@/components/shared/EmptyState'
import { IndicadorCard } from '@/components/dashboard/charts/IndicadorCard'
import { EntradasSalidasChart } from '@/components/dashboard/EntradasSalidasChart'
import { StockPorBodegaChart } from '@/components/dashboard/charts/StockPorBodegaChart'
import { StockPorCategoriaChart } from '@/components/dashboard/charts/StockPorCategoriaChart'
import { TopProductosChart } from '@/components/dashboard/charts/TopProductosChart'
import { VehiculosPorEtapaChart } from '@/components/dashboard/charts/VehiculosPorEtapaChart'
import { AjustesOCPorEstadoChart } from '@/components/dashboard/charts/AjustesOCPorEstadoChart'
import { ValorizacionChart } from '@/components/dashboard/charts/ValorizacionChart'

export async function DashboardGraficasSection({
  rol,
  filtros,
  variante,
  entradasVsSalidas,
}: {
  rol: Role
  filtros: DashboardFiltros
  variante: DashboardVariante
  entradasVsSalidas: EntradaSalidaDia[]
}) {
  let graficas: DashboardGraficasPayload | null = null
  try {
    graficas = await fetchDashboardGraficas(rol, filtros)
  } catch (error) {
    // El RPC `dashboard_graficas` es un placeholder pendiente del contrato de
    // backend (ver dashboard-graficas-actions.ts) — hasta que exista, esta
    // sección se degrada a un EmptyState en vez de propagar el error hacia
    // arriba, lo que tronaría TODO el dashboard (KPIs, calendario, tabla de
    // movimientos) vía app/(panel)/error.tsx para cualquier rol.
    console.error('Error al cargar dashboard_graficas:', error)
  }

  if (!graficas) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Gráficas no disponibles"
        description="Intenta de nuevo más tarde."
      />
    )
  }

  const CHARTS_POR_VARIANTE: Record<DashboardVariante, ReactNode[]> = {
    completo: [
      <EntradasSalidasChart key="es" data={entradasVsSalidas} />,
      <StockPorBodegaChart key="sb" data={graficas.stockPorBodega} />,
      <StockPorCategoriaChart key="sc" data={graficas.stockPorCategoria} />,
      <TopProductosChart key="tp" data={graficas.topProductos} />,
      <VehiculosPorEtapaChart key="ve" data={graficas.vehiculosPorEtapa} />,
      <AjustesOCPorEstadoChart key="ao" data={graficas.ajustesOCPorEstado} />,
      <ValorizacionChart key="val" data={graficas.valorizacion} />,
    ],
    compras: [
      <StockPorBodegaChart key="sb" data={graficas.stockPorBodega} />,
      <AjustesOCPorEstadoChart key="ao" data={graficas.ajustesOCPorEstado} />,
      <ValorizacionChart key="val" data={graficas.valorizacion} />,
    ],
    bitacora: [
      <EntradasSalidasChart key="es" data={entradasVsSalidas} />,
      <AjustesOCPorEstadoChart key="ao" data={graficas.ajustesOCPorEstado} />,
      <ValorizacionChart key="val" data={graficas.valorizacion} />,
    ],
    comercial: [
      <StockPorBodegaChart key="sb" data={graficas.stockPorBodega} />,
      <StockPorCategoriaChart key="sc" data={graficas.stockPorCategoria} />,
      <TopProductosChart key="tp" data={graficas.topProductos} />,
      <VehiculosPorEtapaChart key="ve" data={graficas.vehiculosPorEtapa} />,
    ],
    taller: [<VehiculosPorEtapaChart key="ve" data={graficas.vehiculosPorEtapa} />],
    instalacion: [<VehiculosPorEtapaChart key="ve" data={graficas.vehiculosPorEtapa} />],
    basico: [<StockPorBodegaChart key="sb" data={graficas.stockPorBodega} />],
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {graficas.kpis.map((k) => (
          <IndicadorCard key={k.id} kpi={k} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {CHARTS_POR_VARIANTE[variante]}
      </div>
    </>
  )
}
