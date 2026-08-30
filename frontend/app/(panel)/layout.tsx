import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  let user = null
  try {
    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser()
    user = fetchedUser
  } catch {
    user = null
  }

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="p-6">{children}</main>
    </div>
  )
}
