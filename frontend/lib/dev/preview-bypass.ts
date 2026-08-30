import type { User } from '@supabase/supabase-js'
import type { Profile, Role } from '@/lib/types/database'

const VALID_ROLES: Role[] = [
  'supervisor',
  'comercial',
  'ingenieria',
  'produccion',
  'compras',
  'auditoria',
  'lectura',
]

export function isDevBypassActive(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_SKIP_AUTH === 'true'
}

export function getDevPreviewUser(): User {
  // Minimal fields the rest of the app actually reads (id, email), completed
  // with placeholder values for the remaining required Supabase User fields.
  // This is a type assertion on an already-typed literal, not a bare `any`.
  return {
    id: 'dev-preview-user',
    email: 'dev@carreraarango.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as User
}

export function getDevPreviewProfile(): Profile {
  const envRole = process.env.DEV_SKIP_AUTH_ROLE
  const role: Role = VALID_ROLES.includes(envRole as Role) ? (envRole as Role) : 'supervisor'
  return { id: 'dev-preview-user', full_name: 'Vista Previa Dev', role }
}
