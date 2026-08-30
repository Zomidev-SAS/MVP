import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import type { Role } from '@/lib/types/database'

export async function RoleGuard({
  allowed,
  children,
}: {
  allowed: readonly Role[]
  children: React.ReactNode
}) {
  const result = await getCurrentProfile()

  if (result.status === 'no-session') {
    redirect('/login')
  }

  if (result.status === 'no-profile' || !allowed.includes(result.profile.role)) {
    redirect('/acceso-denegado')
  }

  return <>{children}</>
}
