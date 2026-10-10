/** Solo paths internos absolutos; bloquea open redirects (//evil.com). */
export function safeRedirectPath(next: string | null | undefined, fallback = '/establecer-password'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return fallback
  }
  return next
}
