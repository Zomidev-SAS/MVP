import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { fetchNotificaciones } from '@/lib/supabase/notificaciones-actions'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { PageTransition } from '@/components/layout/PageTransition'
import { NewAlertToastListener } from '@/components/notifications/NewAlertToastListener'

export const dynamic = 'force-dynamic'

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const result = await getCurrentProfile()

  if (result.status === 'no-session') {
    redirect('/login')
  }

  if (result.status === 'no-profile') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p>No se pudo cargar tu perfil. Contacta a un administrador.</p>
      </div>
    )
  }

  if (!result.profile.activo) {
    redirect('/login?error=cuenta-inactiva')
  }

  const notificaciones = await fetchNotificaciones(result.profile.rol).catch(() => ({
    alertas: [],
    mensajes: [],
    totalSinLeer: 0,
  }))
  const ajusteAlerta = notificaciones.alertas.find((a) => a.tipo === 'ajustes_pendientes')
  const ajustesPendientes =
    result.profile.rol === 'supervisor' && ajusteAlerta?.tipo === 'ajustes_pendientes'
      ? ajusteAlerta.cantidad
      : undefined

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <NewAlertToastListener />
      <Sidebar profile={result.profile} ajustesPendientes={ajustesPendientes} />
      <div className="flex flex-1 flex-col">
        <Header
          profile={result.profile}
          ajustesPendientes={ajustesPendientes}
          notificaciones={notificaciones}
          esSupervisor={result.profile.rol === 'supervisor'}
          // Sigue sin persistir entre recargas: `notificaciones_leidas` no
          // existe, y el backend construyó un sistema distinto en su lugar
          // (tabla `notificaciones` por instancia/usuario, migración 033) que
          // no mapea 1:1 contra estas alertas sintéticas por categoría — ver
          // la nota en notificaciones-actions.ts. Queda como decisión de
          // producto, no como algo pendiente de nombrar.
          leidas={new Set<string>()}
        />
        <main className="flex-1 p-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  )
}
