import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS, CAN_VIEW_COSTS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { InventoryTable } from '@/components/inventario/InventoryTable'

export default function InventarioPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.inventario}>
      <InventarioContent />
    </RoleGuard>
  )
}

async function InventarioContent() {
  const result = await getCurrentProfile()
  const puedeVerCostos =
    result.status === 'authenticated' && CAN_VIEW_COSTS.includes(result.profile.rol)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Inventario</h1>
      <InventoryTable puedeVerCostos={puedeVerCostos} />
    </div>
  )
}
