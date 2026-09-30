import { getRequestOrigin } from '@/lib/auth/request-origin'
import { safeRedirectPath } from '@/lib/auth/safe-redirect-path'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const origin = getRequestOrigin(request)
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeRedirectPath(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=enlace-invalido`)
}
