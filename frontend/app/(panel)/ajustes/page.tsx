import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { AdjustmentForm } from '@/components/ajustes/AdjustmentForm'
import { AdjustmentApproval } from '@/components/ajustes/AdjustmentApproval'

export default function AjustesPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.ajustes}>
      <AjustesContent />
    </RoleGuard>
  )
}

async function AjustesContent() {
  const result = await getCurrentProfile()

  if (result.status !== 'authenticated') {
    // Unreachable in practice — RoleGuard already redirected before this
    // renders if there's no session or no profile.
    return null
  }

  const esSupervisor = result.profile.rol === 'supervisor'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Ajustes</h1>
        <p className="text-muted-foreground">Solicitar ajuste de inventario</p>
      </div>
      <AdjustmentForm />
      {esSupervisor && <AdjustmentApproval />}
    </div>
  )
}
