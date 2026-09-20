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
      <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <strong className="text-foreground">Bitácora del inventario.</strong> Las{' '}
        <strong>entradas</strong> suben stock (apertura, CSV, entradas manuales). Las{' '}
        <strong>salidas (app móvil)</strong> bajan <strong>1 unidad</strong> por cada formulario
        de ingreso en vehiculosapp — un vehículo registrado = una unidad menos en inventario. El
        tipo <code className="rounded bg-muted px-1">salida_vin</code> es el nombre técnico
        heredado del diseño original por VIN/chasis.
      </div>
      <MovementsTable puedeVerCostos={puedeVerCostos} />
    </div>
  )
}
