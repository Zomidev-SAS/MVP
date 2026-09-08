import type { Role } from '@/lib/types/database'

export interface UsuarioListado {
  id: string
  nombre: string | null
  rol: Role
  activo: boolean
  created_at: string
}

export type UsuarioResultado = { ok: true } | { ok: false; error: string }
