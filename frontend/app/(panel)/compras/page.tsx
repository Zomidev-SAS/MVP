import { RoleGuard } from '@/components/shared/RoleGuard'
import { ComprasTable } from '@/components/compras/ComprasTable'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'

interface ComprasPageProps {
  searchParams: Promise<{ producto?: string; nombre?: string }>
}

export default function ComprasPage({ searchParams }: ComprasPageProps) {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.compras}>
      <ComprasContent searchParams={searchParams} />
    </RoleGuard>
  )
}

async function ComprasContent({ searchParams }: ComprasPageProps) {
  const [params, result] = await Promise.all([searchParams, getCurrentProfile()])
  const productoInicial =
    params.producto?.trim()
      ? {
          codigo: params.producto.trim(),
          nombre: params.nombre?.trim() || params.producto.trim(),
        }
      : null
  const puedeGestionarSiigo =
    result.status === 'authenticated' &&
    (result.profile.rol === 'supervisor' || result.profile.rol === 'compras')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Compras — pedidos</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona órdenes de compra con varios proveedores y productos. Genera el PDF para Siigo y
          registra entregas parciales en el campo de texto.
        </p>
      </div>
      <ComprasTable productoInicial={productoInicial} puedeGestionarSiigo={puedeGestionarSiigo} />
    </div>
  )
}
