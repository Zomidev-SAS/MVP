import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { UsersTable } from '@/components/usuarios/UsersTable'

export default function UsuariosPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.usuarios}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Usuarios</h1>
          <p className="text-muted-foreground">Gestión de roles y acceso</p>
        </div>
        <UsersTable />
      </div>
    </RoleGuard>
  )
}
