import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/get-session-user'
import { isDevBypassActive, getDevPreviewProfile } from '@/lib/dev/preview-bypass'
import type { Profile } from '@/lib/types/database'

export const getCurrentProfile = cache(async () => {
  const user = await getSessionUser()
  if (!user) return null

  if (isDevBypassActive()) {
    return { user, profile: getDevPreviewProfile() }
  }

  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single<Profile>()

  if (error || !profile) {
    console.error('Failed to load profile:', error)
    return null
  }

  return { user, profile }
})
