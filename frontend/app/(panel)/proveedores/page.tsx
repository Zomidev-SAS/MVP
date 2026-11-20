import { RoleGuard } from '@/components/shared/RoleGuard'
import { ProveedoresVista } from '@/components/proveedores/ProveedoresVista'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'

interface ProveedoresPageProps {
  searchParams: Promise<{ vista?: string }>
}

export default function ProveedoresPage({ searchParams }: ProveedoresPageProps) {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.proveedores}>
      <ProveedoresContent searchParams={searchParams} />
    </RoleGuard>
  )
}

async function ProveedoresContent({ searchParams }: ProveedoresPageProps) {
  const [result, { vista }] = await Promise.all([getCurrentProfile(), searchParams])
  const puedeEliminar = result.status === 'authenticated' && result.profile.rol === 'supervisor'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Proveedores</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo, desempeño por orden de compra, reevaluación anual y evaluación de proveedores nuevos.
        </p>
      </div>
      <ProveedoresVista
        puedeEliminar={puedeEliminar}
        vistaInicial={vista === 'seleccion' ? 'seleccion' : 'proveedores'}
      />
    </div>
  )
}
