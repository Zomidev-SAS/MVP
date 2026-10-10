import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { fetchNotificaciones } from '@/lib/supabase/notificaciones-actions'
import { NotificacionesHistorial } from '@/components/notifications/NotificacionesHistorial'

export default function NotificacionesPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.notificaciones}>
      <NotificacionesContent />
    </RoleGuard>
  )
}

async function NotificacionesContent() {
  const result = await getCurrentProfile()

  if (result.status !== 'authenticated') {
    // Unreachable in practice — RoleGuard already redirected before this
    // renders if there's no session or no profile.
    return null
  }

  const payload = await fetchNotificaciones(result.profile.rol)

  return <NotificacionesHistorial alertas={payload.alertas} mensajes={payload.mensajes} />
}
