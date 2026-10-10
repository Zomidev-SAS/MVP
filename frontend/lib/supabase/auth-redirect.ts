import { safeRedirectPath } from '@/lib/auth/safe-redirect-path'

/** URL de callback OAuth/recuperación — debe estar en Supabase Auth → Redirect URLs. */
export function getAuthCallbackUrl(nextPath = '/establecer-password'): string {
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const safeNext = safeRedirectPath(nextPath)
  return `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`
}
