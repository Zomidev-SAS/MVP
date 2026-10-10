import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive, getDevPreviewUser } from '@/lib/dev/preview-bypass'

/**
 * Returns the currently authenticated Supabase user for this request, or
 * null if there is no session or the lookup fails.
 */
export async function getSessionUser() {
  if (isDevBypassActive()) {
    return getDevPreviewUser()
  }

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
