import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { ProveedorFicha } from '@/components/proveedores/ProveedorFicha'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { fetchHistorialProveedor, fetchProveedorById } from '@/lib/supabase/proveedores-actions'
import { fetchReevaluaciones } from '@/lib/supabase/proveedor-reevaluacion-actions'

interface ProveedorPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ orden?: string }>
}

export default function ProveedorPage({ params, searchParams }: ProveedorPageProps) {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.proveedores}>
      <ProveedorContent params={params} searchParams={searchParams} />
    </RoleGuard>
  )
}

async function ProveedorContent({ params, searchParams }: ProveedorPageProps) {
  const [{ id }, { orden }] = await Promise.all([params, searchParams])
  const ordenInicial = orden && /^\d+$/.test(orden) ? Number(orden) : null
  const proveedorId = Number(id)
  if (!Number.isInteger(proveedorId) || proveedorId <= 0) notFound()

  const proveedor = await fetchProveedorById(proveedorId)
  if (!proveedor) notFound()

  const [historial, reevaluaciones] = await Promise.all([
    fetchHistorialProveedor(proveedorId),
    fetchReevaluaciones(proveedorId),
  ])
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

      <ProveedorFicha
        filas={historial.filas}
        errorHistorial={historial.error}
        config={historial.config}
        proveedorId={proveedor.id}
        proveedor={{ nombre: proveedor.nombre, nit: proveedor.nit }}
        reevaluaciones={reevaluaciones.reevaluaciones}
        errorReevaluaciones={reevaluaciones.error}
        ordenInicial={ordenInicial}
      />
    </div>
  )
}
