import {
  AlertTriangle,
  ArrowLeftRight,
  Car,
  ClipboardList,
  DollarSign,
  FilePlus,
  Package,
  SlidersHorizontal,
  Upload,
} from 'lucide-react'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS, CAN_VIEW_COSTS } from '@/lib/permissions/roles'
import { VARIANTE_POR_ROL } from '@/lib/permissions/dashboard-variante'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { getDashboardData } from '@/lib/supabase/get-dashboard-data'
import { fetchProductosBajoStock } from '@/lib/supabase/inventario-saldos-actions'
import { formatCOP, formatNumber } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { CalendarWidget } from '@/components/dashboard/CalendarWidget'
import { EntradasSalidasChart } from '@/components/dashboard/EntradasSalidasChart'
import { UltimosMovimientosTable } from '@/components/dashboard/UltimosMovimientosTable'
import { RealtimeRefresher } from '@/components/dashboard/RealtimeRefresher'
import { QuickLinksCard } from '@/components/dashboard/QuickLinksCard'
import { LowStockList } from '@/components/dashboard/LowStockList'

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

  return (
    <div className="space-y-6">
      {variante !== 'bitacora' && variante !== 'basico' && <CalendarWidget />}

      <div>
        <h1 className="text-2xl font-semibold">
          Bienvenido, {result.profile.nombre ?? result.user.email}
        </h1>
        <p className="text-muted-foreground">Rol: {result.profile.rol}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Total Unidades en Stock"
          value={formatNumber(data.totalUnidades)}
          icon={Package}
        />
        {puedeVerCostos && (
          <KpiCard
            label="Valor Total del Inventario"
            value={formatCOP(data.valorTotal)}
            icon={DollarSign}
          />
        )}
        {variante !== 'basico' && (
          <KpiCard
            label="Movimientos del Día"
            value={formatNumber(data.movimientosHoy)}
            icon={ArrowLeftRight}
          />
        )}
        <KpiCard
          label="VINs con Stock Bajo"
          value={formatNumber(data.stockBajo)}
          icon={AlertTriangle}
        />
      </div>

      {(variante === 'completo' || variante === 'comercial' || variante === 'compras') && (
        <Card>
          <CardHeader>
            <CardTitle>Entradas vs Salidas (últimos 7 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <EntradasSalidasChart data={data.entradasVsSalidas} />
          </CardContent>
        </Card>
      )}

      {variante === 'compras' && <LowStockList productos={productosBajoStock} />}

      {variante === 'comercial' && (
        <QuickLinksCard
          enlaces={[
            { label: 'Vehículos (VIN)', href: '/vehiculos', icon: Car },
            { label: 'Inventario', href: '/inventario', icon: Package },
          ]}
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
            { label: 'Vehículos (VIN)', href: '/vehiculos', icon: Car },
            { label: 'Formularios', href: '/formularios', icon: ClipboardList },
            { label: 'Ajustes', href: '/ajustes', icon: SlidersHorizontal },
          ]}
        />
      )}

      {variante === 'instalacion' && (
        <QuickLinksCard enlaces={[{ label: 'Vehículos (VIN)', href: '/vehiculos', icon: Car }]} />
      )}

      {variante !== 'basico' && (
        <Card>
          <CardHeader>
            <CardTitle>
              {variante === 'bitacora'
                ? 'Bitácora de actividad'
                : variante === 'instalacion'
                  ? 'Vehículos con movimiento reciente'
                  : 'Últimos movimientos'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UltimosMovimientosTable movimientos={data.ultimosMovimientos} />
          </CardContent>
        </Card>
      )}

      <RealtimeRefresher />
    </div>
  )
}
