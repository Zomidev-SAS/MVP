import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'

export default function InventarioPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.inventario}>
      <div className="py-24 text-center">
        <h1 className="text-xl font-semibold">Inventario</h1>
        <p className="mt-2 text-muted-foreground">Próximamente.</p>
      </div>
    </RoleGuard>
  )
}
