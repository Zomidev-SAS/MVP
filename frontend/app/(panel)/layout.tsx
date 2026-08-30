import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

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

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar role={result.profile.role} />
      <div className="flex flex-1 flex-col">
        <Header profile={result.profile} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
