import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { fetchNotificaciones } from '@/lib/supabase/notificaciones-actions'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { PageTransition } from '@/components/layout/PageTransition'

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
      <Sidebar profile={result.profile} ajustesPendientes={ajustesPendientes} />
      <div className="flex flex-1 flex-col">
        <Header
          profile={result.profile}
          ajustesPendientes={ajustesPendientes}
          notificaciones={notificaciones}
          esSupervisor={result.profile.rol === 'supervisor'}
          // Placeholder hasta que exista la tabla notificaciones_leidas en el
          // backend (ver Task 3.1): por ahora el estado "leída" solo vive en
          // el cliente, sin persistencia entre recargas.
          leidas={new Set<string>()}
        />
        <main className="flex-1 p-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  )
}
