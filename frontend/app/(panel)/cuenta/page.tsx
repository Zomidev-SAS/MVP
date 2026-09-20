import { RoleGuard } from '@/components/shared/RoleGuard'
import { CuentaForm } from '@/components/cuenta/CuentaForm'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'

export default function CuentaPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.cuenta}>
      <CuentaContent />
    </RoleGuard>
  )
}

async function CuentaContent() {
  const result = await getCurrentProfile()

  if (result.status !== 'authenticated') {
    return <p className="text-muted-foreground">No se pudo cargar tu cuenta.</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Mi cuenta</h1>
      <CuentaForm email={result.user.email ?? ''} profile={result.profile} />
    </div>
  )
}
