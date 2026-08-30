import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase/get-session-user'

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="p-6">{children}</main>
    </div>
  )
}
