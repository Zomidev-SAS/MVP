import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { InventoryTable } from '@/components/inventario/InventoryTable'

export default function InventarioPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.inventario}>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Inventario</h1>
        <InventoryTable />
      </div>
    </RoleGuard>
  )
}
