import { notFound, redirect } from 'next/navigation'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { fetchProveedorIdPorNit } from '@/lib/supabase/proveedores-actions'

interface ProveedorPorNitProps {
  params: Promise<{ nit: string }>
  searchParams: Promise<{ orden?: string }>
}

/** Enlace desde una orden de compra: busca el proveedor por NIT y abre su ficha en esa orden. */
export default function ProveedorPorNitPage({ params, searchParams }: ProveedorPorNitProps) {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.proveedores}>
      <Redirigir params={params} searchParams={searchParams} />
    </RoleGuard>
  )
}

async function Redirigir({ params, searchParams }: ProveedorPorNitProps): Promise<null> {
  const [{ nit }, { orden }] = await Promise.all([params, searchParams])
  const id = await fetchProveedorIdPorNit(decodeURIComponent(nit))
  if (!id) notFound()

  const sufijo = orden && /^\d+$/.test(orden) ? `?orden=${orden}` : ''
  redirect(`/proveedores/${id}${sufijo}`)
}
