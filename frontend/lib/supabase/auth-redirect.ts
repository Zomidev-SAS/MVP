/** URL de callback OAuth/recuperación — debe estar en Supabase Auth → Redirect URLs. */
export function getAuthCallbackUrl(nextPath = '/establecer-password'): string {
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  return `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
}
