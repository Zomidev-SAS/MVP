import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS, CAN_VIEW_COSTS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { fetchInventarioVehiculos } from '@/lib/supabase/inventario-actions'
import { InventoryTable } from '@/components/inventario/InventoryTable'

export default function VehiculosPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.vehiculos}>
      <VehiculosContent />
    </RoleGuard>
  )
}

async function VehiculosContent() {
  const result = await getCurrentProfile()
  const puedeVerCostos =
    result.status === 'authenticated' && CAN_VIEW_COSTS.includes(result.profile.rol)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Vehículos (VIN)</h1>
      <InventoryTable puedeVerCostos={puedeVerCostos} fetchFn={fetchInventarioVehiculos} />
    </div>
  )
}
