import { notFound } from 'next/navigation'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { SeleccionEditor } from '@/components/proveedores/SeleccionEditor'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { fetchProveedores } from '@/lib/supabase/proveedores-actions'
import { fetchSeleccionById } from '@/lib/supabase/proveedor-seleccion-actions'

interface SeleccionPageProps {
  params: Promise<{ id: string }>
}

export default function SeleccionPage({ params }: SeleccionPageProps) {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.proveedores}>
      <SeleccionContent params={params} />
    </RoleGuard>
  )
}

async function SeleccionContent({ params }: SeleccionPageProps) {
  const { id } = await params
  const esNueva = id === 'nuevo'
  const seleccionId = Number(id)
  if (!esNueva && (!Number.isInteger(seleccionId) || seleccionId <= 0)) notFound()

  const [seleccion, proveedores, perfil] = await Promise.all([
    esNueva ? Promise.resolve(null) : fetchSeleccionById(seleccionId),
    fetchProveedores(),
    getCurrentProfile(),
  ])
  if (!esNueva && !seleccion) notFound()

  const puedeEliminar = perfil.status === 'authenticated' && perfil.profile.rol === 'supervisor'

  return (
    <SeleccionEditor
      key={seleccion?.updated_at ?? 'nueva'}
      seleccion={seleccion}
      proveedores={proveedores.filas}
      puedeEliminar={puedeEliminar}
    />
  )
}
