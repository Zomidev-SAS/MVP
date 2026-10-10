import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { ConfiguracionForm } from '@/components/configuracion/ConfiguracionForm'

export default function ConfiguracionPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.configuracion}>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Configuración</h1>
        <ConfiguracionForm />
      </div>
    </RoleGuard>
  )
}
