import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getRouteKeyForPath, ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import type { Role } from '@/lib/types/database'

export async function middleware(request: NextRequest) {
  if (isDevBypassActive()) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  try {
    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser()
    user = fetchedUser
  } catch {
    user = null
  }

  const isLoginPage = request.nextUrl.pathname === '/login'
  const isEstablecerPasswordPage = request.nextUrl.pathname === '/establecer-password'
  const isRecuperarPasswordPage = request.nextUrl.pathname === '/recuperar-password'
  const isAuthCallback = request.nextUrl.pathname.startsWith('/auth/callback')
  const isPublicAuthPage =
    isLoginPage || isEstablecerPasswordPage || isRecuperarPasswordPage || isAuthCallback

  if (!user && !isPublicAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && (isLoginPage || isRecuperarPasswordPage)) {
    const url = request.nextUrl.clone()
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single<{ rol: Role }>()
      url.pathname = profile?.rol === 'lectura' ? '/visualizacion' : '/'
    } catch {
      url.pathname = '/'
    }
    return NextResponse.redirect(url)
  }

  if (user) {
    const routeKey = getRouteKeyForPath(request.nextUrl.pathname)

    if (routeKey) {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('rol, activo')
          .eq('id', user.id)
          .single<{ rol: Role; activo: boolean }>()

        const permitido =
          !error && !!profile && profile.activo && ROUTE_PERMISSIONS[routeKey].includes(profile.rol)

        if (profile && profile.rol === 'lectura' && routeKey === 'dashboard') {
          const url = request.nextUrl.clone()
          url.pathname = '/visualizacion'
          return NextResponse.redirect(url)
        }

        if (!permitido) {
          const url = request.nextUrl.clone()
          url.pathname = '/acceso-denegado'
          return NextResponse.redirect(url)
        }
      } catch {
        // Supabase temporalmente inaccesible — deja pasar; RoleGuard en la página actúa como respaldo.
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
