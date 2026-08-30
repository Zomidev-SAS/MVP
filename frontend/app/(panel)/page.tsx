import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'

export default function DashboardPlaceholderPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.dashboard}>
      <DashboardContent />
    </RoleGuard>
  )
}

async function DashboardContent() {
  const result = await getCurrentProfile()

  if (!result) {
    // Unreachable in practice — RoleGuard already redirected before this
    // renders if there's no session. Guards against the type being nullable.
    return null
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        Bienvenido, {result.profile.full_name ?? result.user.email}
      </h1>
      <p className="text-muted-foreground">Rol: {result.profile.role}</p>
    </div>
  )
}
