import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'

export default function MovimientosPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.movimientos}>
      <div className="py-24 text-center">
        <h1 className="text-xl font-semibold">Movimientos</h1>
        <p className="mt-2 text-muted-foreground">Próximamente.</p>
      </div>
    </RoleGuard>
  )
}
