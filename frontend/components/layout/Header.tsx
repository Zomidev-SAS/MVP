import { HeaderMessages } from '@/components/layout/HeaderMessages'
import { HeaderNotifications } from '@/components/layout/HeaderNotifications'
import type { NotificacionesPayload } from '@/lib/types/notificaciones'

export function Header({
  notificaciones,
  esSupervisor,
}: {
  notificaciones: NotificacionesPayload
  esSupervisor: boolean
}) {
  return (
    <header className="flex items-center justify-end gap-3 border-b border-border bg-card px-6 py-3">
      <HeaderMessages initial={notificaciones.mensajes} esSupervisor={esSupervisor} />
      <HeaderNotifications alertas={notificaciones.alertas} />
    </header>
  )
}
