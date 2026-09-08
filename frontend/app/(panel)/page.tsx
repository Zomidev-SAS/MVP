import { AlertTriangle, ArrowLeftRight, DollarSign, Package } from 'lucide-react'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { getDashboardData } from '@/lib/supabase/get-dashboard-data'
import { formatCOP, formatNumber } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { CalendarWidget } from '@/components/dashboard/CalendarWidget'
import { EntradasSalidasChart } from '@/components/dashboard/EntradasSalidasChart'
import { UltimosMovimientosTable } from '@/components/dashboard/UltimosMovimientosTable'
import { RealtimeRefresher } from '@/components/dashboard/RealtimeRefresher'

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

  const data = await getDashboardData()

  return (
    <div className="space-y-6">
      <CalendarWidget />

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
        <KpiCard
          label="Valor Total del Inventario"
          value={formatCOP(data.valorTotal)}
          icon={DollarSign}
        />
        <KpiCard
          label="Movimientos del Día"
          value={formatNumber(data.movimientosHoy)}
          icon={ArrowLeftRight}
        />
        <KpiCard
          label="VINs con Stock Bajo"
          value={formatNumber(data.stockBajo)}
          icon={AlertTriangle}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entradas vs Salidas (últimos 7 días)</CardTitle>
        </CardHeader>
        <CardContent>
          <EntradasSalidasChart data={data.entradasVsSalidas} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <UltimosMovimientosTable movimientos={data.ultimosMovimientos} />
        </CardContent>
      </Card>

      <RealtimeRefresher />
    </div>
  )
}
