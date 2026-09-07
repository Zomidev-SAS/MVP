import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { MovementsTable } from '@/components/movimientos/MovementsTable'

export default function MovimientosPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.movimientos}>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Movimientos</h1>
        <MovementsTable />
      </div>
    </RoleGuard>
  )
}
