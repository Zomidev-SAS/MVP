import { createBrowserClient } from '@supabase/ssr'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'

// Anon key de demo de Supabase local; solo se usa si el bypass dev está activo
// y no hay credenciales reales configuradas.
const DEV_PLACEHOLDER_URL = 'http://127.0.0.1:54321'
const DEV_PLACEHOLDER_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (url && key) {
    return createBrowserClient(url, key)
  }

  if (isDevBypassActive()) {
    return createBrowserClient(DEV_PLACEHOLDER_URL, DEV_PLACEHOLDER_ANON_KEY)
  }

  throw new Error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. Configúralas en .env.local o activa DEV_SKIP_AUTH.'
  )
}
