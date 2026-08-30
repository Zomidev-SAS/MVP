import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const result = await getCurrentProfile()

  if (!result) {
    redirect('/login')
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
