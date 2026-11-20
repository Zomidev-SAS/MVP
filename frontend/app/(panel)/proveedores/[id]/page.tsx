import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { HistorialTabla } from '@/components/proveedores/HistorialTabla'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { fetchHistorialProveedor, fetchProveedorById } from '@/lib/supabase/proveedores-actions'

export default function ProveedorPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.proveedores}>
      <ProveedorContent params={params} />
    </RoleGuard>
  )
}

async function ProveedorContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const proveedorId = Number(id)
  if (!Number.isInteger(proveedorId) || proveedorId <= 0) notFound()

  const proveedor = await fetchProveedorById(proveedorId)
  if (!proveedor) notFound()

  const historial = await fetchHistorialProveedor(proveedorId)
  const datosContacto = [proveedor.contacto, proveedor.email, proveedor.telefono].filter(Boolean)

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Link
          href="/proveedores"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          Proveedores
        </Link>
        <h1 className="text-2xl font-semibold">{proveedor.nombre}</h1>
        <p className="text-sm text-muted-foreground">
          <span className="tabular-nums">NIT {proveedor.nit}</span>
          {datosContacto.length > 0 && <> · {datosContacto.join(' · ')}</>}
          {!proveedor.activo && <> · Inactivo</>}
        </p>
      </div>

      <HistorialTabla filas={historial.filas} error={historial.error} />
    </div>
  )
}
