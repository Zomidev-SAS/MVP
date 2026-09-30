/** Origen público de la app — correcto detrás de nginx/Docker (evita 0.0.0.0:3000). */
export function getRequestOrigin(request: Request): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (siteUrl) {
    try {
      return new URL(siteUrl).origin
    } catch {
      // continuar con headers
    }
  }

  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'

  if (forwardedHost) {
    const host = forwardedHost.split(',')[0]?.trim()
    if (host && !isInternalHost(host)) {
      return `${forwardedProto}://${host}`
    }
  }

  const host = request.headers.get('host')
  if (host && !isInternalHost(host)) {
    return `${forwardedProto}://${host}`
  }

  return new URL(request.url).origin
}

function isInternalHost(host: string): boolean {
  return host.startsWith('0.0.0.0') || host.startsWith('127.0.0.1') || host === 'localhost:3000'
}
