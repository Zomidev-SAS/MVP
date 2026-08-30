import { createClient } from '@/lib/supabase/server'

/**
 * Returns the currently authenticated Supabase user for this request, or
 * null if there is no session or the lookup fails.
 */
export async function getSessionUser() {
  const supabase = await createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}
