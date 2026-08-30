import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'

export default function AjustesPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.ajustes}>
      <div className="py-24 text-center">
        <h1 className="text-xl font-semibold">Ajustes</h1>
        <p className="mt-2 text-muted-foreground">Próximamente.</p>
      </div>
    </RoleGuard>
  )
}
