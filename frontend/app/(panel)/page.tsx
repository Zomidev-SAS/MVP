import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import type { Profile } from '@/lib/types/database'

export default async function DashboardPlaceholderPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single<Profile>()

  if (error || !profile) {
    console.error('Failed to load profile:', error)
    return (
      <p>No se pudo cargar tu perfil. Contacta a un administrador.</p>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        Bienvenido, {profile.full_name ?? user.email}
      </h1>
      <p className="text-muted-foreground">Rol: {profile.role}</p>
    </div>
  )
}
