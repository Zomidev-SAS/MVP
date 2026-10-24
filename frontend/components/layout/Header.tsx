import { HeaderMessages } from '@/components/layout/HeaderMessages'
import { HeaderNotifications } from '@/components/layout/HeaderNotifications'
import { MobileSidebarSheet } from '@/components/layout/MobileSidebarSheet'
import type { NotificacionesPayload } from '@/lib/types/notificaciones'
import type { Profile } from '@/lib/types/database'

export function Header({
  profile,
  ajustesPendientes,
  notificaciones,
  esSupervisor,
  leidas,
}: {
  profile: Profile
  ajustesPendientes?: number
  notificaciones: NotificacionesPayload
  esSupervisor: boolean
  leidas: Set<string>
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-6 py-3">
      <MobileSidebarSheet profile={profile} ajustesPendientes={ajustesPendientes} />
      <div className="flex flex-1 items-center justify-end gap-3">
        <HeaderMessages initial={notificaciones.mensajes} esSupervisor={esSupervisor} />
        <HeaderNotifications alertas={notificaciones.alertas} leidas={leidas} />
      </div>
    </header>
  )
}
