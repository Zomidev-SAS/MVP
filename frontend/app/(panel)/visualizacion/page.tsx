import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { fetchEntradasSalidasFormulariosSemana } from '@/lib/supabase/lectura-panel-actions'
import { VehiculoTimelineCard } from '@/components/dashboard/VehiculoTimelineCard'
import { EntradasSalidasChart } from '@/components/dashboard/EntradasSalidasChart'
import { RealtimeRefresher } from '@/components/dashboard/RealtimeRefresher'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function VisualizacionPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.visualizacion}>
      <VisualizacionContent />
    </RoleGuard>
  )
}

async function VisualizacionContent() {
  const result = await getCurrentProfile()
  if (result.status !== 'authenticated') return null

  const entradasSalidas = await fetchEntradasSalidasFormulariosSemana()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Panel operativo</h1>
        <p className="text-sm text-muted-foreground">
          Vista general de vehículos, entradas y salidas. Sin inventario ni valores de stock.
        </p>
      </div>

      <VehiculoTimelineCard rolActual={result.profile.rol} />

      <Card>
        <CardHeader>
          <CardTitle>Entradas vs salidas de vehículos (7 días)</CardTitle>
        </CardHeader>
        <CardContent>
          <EntradasSalidasChart data={entradasSalidas} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Formularios</CardTitle>
          <Link
            href="/formularios"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
          >
            <ClipboardList className="h-4 w-4" />
            Ver todos
          </Link>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Consulta entradas, salidas y parqueadero desde la bitácora de formularios — sin acceso a
            inventario ni compras.
          </p>
        </CardContent>
      </Card>

      <RealtimeRefresher />
    </div>
  )
}
