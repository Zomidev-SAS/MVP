import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS, CAN_VIEW_COSTS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { MovementsTable } from '@/components/movimientos/MovementsTable'

export default function MovimientosPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.movimientos}>
      <MovimientosContent />
    </RoleGuard>
  )
}

async function MovimientosContent() {
  const result = await getCurrentProfile()
  const puedeVerCostos =
    result.status === 'authenticated' && CAN_VIEW_COSTS.includes(result.profile.rol)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Movimientos</h1>
      <MovementsTable puedeVerCostos={puedeVerCostos} />
    </div>
  )
}
