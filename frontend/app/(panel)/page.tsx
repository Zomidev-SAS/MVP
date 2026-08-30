import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types/database'

export default async function DashboardPlaceholderPage() {
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
    return null
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single<Profile>()

  if (error || !profile) {
    return (
      <p>
        No se pudo cargar tu perfil ({error?.message ?? 'perfil no encontrado'}).
      </p>
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
