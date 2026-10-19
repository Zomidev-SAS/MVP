import { RoleGuard } from '@/components/shared/RoleGuard'
import { ComprasTable } from '@/components/compras/ComprasTable'
import { SiigoCatalogoDiferencias } from '@/components/compras/SiigoCatalogoDiferencias'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { fetchSiigoCatalogoEstado } from '@/lib/supabase/siigo-catalogo-actions'

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

  const puedeFirmar = result.status === 'authenticated' && result.profile.rol === 'supervisor'

  const catalogoSiigo = puedeGestionarSiigo ? await fetchSiigoCatalogoEstado() : null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Compras — pedidos</h1>
        <p className="text-sm text-muted-foreground">
          Sube la orden de compra que genera Siigo (PDF) para visualizarla aquí; el administrador la
          firma y se avisa por correo. También puedes registrar entregas parciales por cantidad.
        </p>
      </div>
      <ComprasTable
        productoInicial={productoInicial}
        puedeGestionarSiigo={puedeGestionarSiigo}
        puedeFirmar={puedeFirmar}
      />
      {catalogoSiigo && <SiigoCatalogoDiferencias estado={catalogoSiigo} />}
    </div>
  )
}
