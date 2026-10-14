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
import { ChartSelector, type ChartSelectorItem } from '@/components/dashboard/ChartSelector'

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

  const es: ChartSelectorItem = {
    id: 'es',
    label: 'Entradas vs Salidas',
    node: <EntradasSalidasChart data={entradasVsSalidas} />,
  }
  const sb: ChartSelectorItem = {
    id: 'sb',
    label: 'Stock por bodega',
    node: <StockPorBodegaChart data={graficas.stockPorBodega} />,
  }
  const sc: ChartSelectorItem = {
    id: 'sc',
    label: 'Stock por categoría',
    node: <StockPorCategoriaChart data={graficas.stockPorCategoria} />,
  }
  const tp: ChartSelectorItem = {
    id: 'tp',
    label: 'Top 10 productos',
    node: <TopProductosChart data={graficas.topProductos} />,
  }
  const ve: ChartSelectorItem = {
    id: 've',
    label: 'Vehículos por etapa',
    node: <VehiculosPorEtapaChart data={graficas.vehiculosPorEtapa} />,
  }
  const ao: ChartSelectorItem = {
    id: 'ao',
    label: 'Ajustes y órdenes de compra por estado',
    node: <AjustesOCPorEstadoChart data={graficas.ajustesOCPorEstado} />,
  }
  const val: ChartSelectorItem = {
    id: 'val',
    label: 'Tendencia de valorización',
    node: <ValorizacionChart data={graficas.valorizacion} />,
  }

  const CHARTS_POR_VARIANTE: Record<DashboardVariante, ChartSelectorItem[]> = {
    completo: [es, sb, sc, tp, ve, ao, val],
    compras: [sb, ao, val],
    bitacora: [es, ao, val],
    comercial: [sb, sc, tp, ve],
    taller: [ve],
    instalacion: [ve],
    basico: [sb],
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {graficas.kpis.map((k) => (
          <IndicadorCard key={k.id} kpi={k} />
        ))}
      </div>
      <ChartSelector items={CHARTS_POR_VARIANTE[variante]} />
    </>
  )
}
