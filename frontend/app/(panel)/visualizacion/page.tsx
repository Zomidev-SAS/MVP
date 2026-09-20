import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { getDashboardData } from '@/lib/supabase/get-dashboard-data'
import {
  PANELES_VISUALIZACION,
  VisualizacionRolePanel,
} from '@/components/visualizacion/VisualizacionRolePanel'
import { RealtimeRefresher } from '@/components/dashboard/RealtimeRefresher'

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

  const data = await getDashboardData(10)

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Visualización en tiempo real</h1>
        <p className="text-sm text-muted-foreground">
          Paneles de cada rol del sistema — se actualizan automáticamente ante cambios en inventario.
        </p>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PANELES_VISUALIZACION.map((panel) => (
          <VisualizacionRolePanel
            key={panel.rol}
            label={panel.label}
            rol={panel.rol}
            variante={panel.variante}
            data={data}
          />
        ))}
      </div>
      <RealtimeRefresher />
    </div>
  )
}
