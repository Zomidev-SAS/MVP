import { RoleGuard } from '@/components/shared/RoleGuard'
import { fetchCorreosEnviados } from '@/lib/supabase/correos-actions'
import { CorreosTable } from '@/components/correos/CorreosTable'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'

export default async function CorreosPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.correos}>
      <CorreosContent />
    </RoleGuard>
  )
}

async function CorreosContent() {
  const [correos, result] = await Promise.all([fetchCorreosEnviados(), getCurrentProfile()])
  const puedeReenviar = result.status === 'authenticated' && result.profile.rol === 'supervisor'

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Correos enviados</h1>
      <CorreosTable correos={correos} puedeReenviar={puedeReenviar} />
    </div>
  )
}
