import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { isDevBypassActive, getDevPreviewProfile } from '@/lib/dev/preview-bypass'
import type { Profile } from '@/lib/types/database'
import type { User } from '@supabase/supabase-js'

export type CurrentProfileResult =
  | { status: 'authenticated'; user: User; profile: Profile }
  | { status: 'no-session' }
  | { status: 'no-profile'; user: User }

export const getCurrentProfile = cache(async (): Promise<CurrentProfileResult> => {
  const user = await getSessionUser()
  if (!user) return { status: 'no-session' }

  if (isDevBypassActive()) {
    return { status: 'authenticated', user, profile: getDevPreviewProfile() }
  }

  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single<Profile>()

  if (error || !profile) {
    console.error('Failed to load profile:', error)
    return { status: 'no-profile', user }
  }

  return { status: 'authenticated', user, profile }
})
