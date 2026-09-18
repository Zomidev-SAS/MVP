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
  // El enlace de invitación establece la sesión del lado del navegador (token
  // en la URL) — el middleware todavía no ve cookie de sesión en esa primera
  // carga, así que esta ruta debe ser pública igual que /login.
  const isEstablecerPasswordPage = request.nextUrl.pathname === '/establecer-password'

  if (!user && !isLoginPage && !isEstablecerPasswordPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  if (user) {
    const routeKey = getRouteKeyForPath(request.nextUrl.pathname)

    if (routeKey) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('rol, activo')
        .eq('id', user.id)
        .single<{ rol: Role; activo: boolean }>()

      const permitido =
        !error && !!profile && profile.activo && ROUTE_PERMISSIONS[routeKey].includes(profile.rol)

      if (!permitido) {
        const url = request.nextUrl.clone()
        url.pathname = '/acceso-denegado'
        return NextResponse.redirect(url)
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
