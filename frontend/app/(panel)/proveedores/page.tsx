import { RoleGuard } from '@/components/shared/RoleGuard'
import { ProveedoresVista } from '@/components/proveedores/ProveedoresVista'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'

export default function ProveedoresPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.proveedores}>
      <ProveedoresContent />
    </RoleGuard>
  )
}

async function ProveedoresContent() {
  const result = await getCurrentProfile()
  const puedeEliminar = result.status === 'authenticated' && result.profile.rol === 'supervisor'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Proveedores</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo de proveedores y su historial de órdenes de compra.
        </p>
      </div>
      <ProveedoresVista puedeEliminar={puedeEliminar} />
    </div>
  )
}
