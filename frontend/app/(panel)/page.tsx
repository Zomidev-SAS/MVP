import { Suspense, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowLeftRight,
  ClipboardList,
  DollarSign,
  FilePlus,
  Package,
  SlidersHorizontal,
  Upload,
} from 'lucide-react'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS, CAN_VIEW_COSTS } from '@/lib/permissions/roles'
import { VARIANTE_POR_ROL, type DashboardVariante } from '@/lib/permissions/dashboard-variante'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { getDashboardData } from '@/lib/supabase/get-dashboard-data'
import { fetchProductosBajoStock } from '@/lib/supabase/inventario-actions'
import { fetchDashboardGraficas } from '@/lib/supabase/dashboard-graficas-actions'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { CalendarWidget } from '@/components/dashboard/CalendarWidget'
import { DashboardFilters } from '@/components/dashboard/DashboardFilters'
import { EntradasSalidasChart } from '@/components/dashboard/EntradasSalidasChart'
import { UltimosMovimientosTable } from '@/components/dashboard/UltimosMovimientosTable'
import { RealtimePanelProvider } from '@/components/realtime/RealtimePanelProvider'
import { QuickLinksCard } from '@/components/dashboard/QuickLinksCard'
import { LowStockList } from '@/components/dashboard/LowStockList'
import { VehiculoTimelineCard } from '@/components/dashboard/VehiculoTimelineCard'
import { IndicadorCard } from '@/components/dashboard/charts/IndicadorCard'
import { StockPorBodegaChart } from '@/components/dashboard/charts/StockPorBodegaChart'
import { StockPorCategoriaChart } from '@/components/dashboard/charts/StockPorCategoriaChart'
import { TopProductosChart } from '@/components/dashboard/charts/TopProductosChart'
import { VehiculosPorEtapaChart } from '@/components/dashboard/charts/VehiculosPorEtapaChart'
import { AjustesOCPorEstadoChart } from '@/components/dashboard/charts/AjustesOCPorEstadoChart'
import { ValorizacionChart } from '@/components/dashboard/charts/ValorizacionChart'

export default function DashboardPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.dashboard}>
      <DashboardContent />
    </RoleGuard>
  )
}

async function DashboardContent() {
  const result = await getCurrentProfile()

  if (result.status !== 'authenticated') {
    // Unreachable in practice — RoleGuard already redirected before this
    // renders if there's no session or no profile.
    return null
  }

  const variante = VARIANTE_POR_ROL[result.profile.rol]
  const puedeVerCostos = CAN_VIEW_COSTS.includes(result.profile.rol)
  const data = await getDashboardData(variante === 'bitacora' ? 25 : 10)
  const productosBajoStock = variante === 'compras' ? await fetchProductosBajoStock(5) : []
  // NOTA: filtros fijos por ahora ({ rango: '7d' }) — cablear `searchParams` de
  // `DashboardFilters` hacia este fetch queda fuera del alcance de esta tarea.
  const graficas = await fetchDashboardGraficas(result.profile.rol, { rango: '7d' })

  const CHARTS_POR_VARIANTE: Record<DashboardVariante, ReactNode[]> = {
    completo: [
      <EntradasSalidasChart key="es" data={graficas.entradasSalidas} />,
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
      <EntradasSalidasChart key="es" data={graficas.entradasSalidas} />,
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

  const mostrarCalendario = variante !== 'bitacora' && variante !== 'basico'

  return (
    <div className="space-y-6">
      <div className={cn('grid gap-6', mostrarCalendario && 'lg:grid-cols-[minmax(0,1fr)_320px]')}>
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-2xl font-semibold">
                Bienvenido, {result.profile.nombre ?? result.user.email}
              </h1>
              <p className="text-muted-foreground">Rol: {result.profile.rol}</p>
            </div>
            <RealtimePanelProvider
              tablas={['movimientos_inventario', 'ajustes_pendientes', 'ordenes_compra', 'mensajes_panel']}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiCard label="Total Unidades en Stock" value={data.totalUnidades} icon={Package} />
            {puedeVerCostos && (
              <KpiCard
                label="Valor Total del Inventario"
                value={data.valorTotal}
                format="currency"
                icon={DollarSign}
              />
            )}
            {variante !== 'basico' && (
              <KpiCard
                label="Movimientos del Día"
                value={data.movimientosHoy}
                icon={ArrowLeftRight}
              />
            )}
            <KpiCard
              label="Productos con Stock Bajo"
              value={data.stockBajo}
              icon={AlertTriangle}
            />
          </div>

          <section className="space-y-4">
            <Suspense fallback={null}>
              <DashboardFilters bodegas={[]} categorias={[]} />
            </Suspense>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {graficas.kpis.map((k) => (
                <IndicadorCard key={k.id} kpi={k} />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {CHARTS_POR_VARIANTE[variante]}
            </div>
          </section>

          <VehiculoTimelineCard rolActual={result.profile.rol} />

          {variante === 'compras' && <LowStockList productos={productosBajoStock} />}

          {variante === 'comercial' && (
            <QuickLinksCard
              enlaces={[{ label: 'Inventario', href: '/inventario', icon: Package }]}
            />
          )}

          {variante === 'compras' && (
            <QuickLinksCard
              enlaces={[
                { label: 'Importar CSV', href: '/importar', icon: Upload },
                { label: 'Entradas', href: '/entradas', icon: FilePlus },
              ]}
            />
          )}

          {variante === 'taller' && (
            <QuickLinksCard
              enlaces={[
                { label: 'Inventario', href: '/inventario', icon: Package },
                { label: 'Formularios', href: '/formularios', icon: ClipboardList },
                { label: 'Ajustes', href: '/ajustes', icon: SlidersHorizontal },
              ]}
            />
          )}

          {variante === 'instalacion' && (
            <QuickLinksCard enlaces={[{ label: 'Inventario', href: '/inventario', icon: Package }]} />
          )}

          {variante !== 'basico' && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {variante === 'bitacora'
                    ? 'Bitácora de actividad'
                    : variante === 'instalacion'
                      ? 'Productos con movimiento reciente'
                      : 'Últimos movimientos'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UltimosMovimientosTable movimientos={data.ultimosMovimientos} />
              </CardContent>
            </Card>
          )}
        </div>

        {mostrarCalendario && (
          <div className="lg:sticky lg:top-6">
            <CalendarWidget />
          </div>
        )}
      </div>
    </div>
  )
}
