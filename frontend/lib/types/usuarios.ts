import { z } from 'zod'
import { ALL_ROLES, type Role } from '@/lib/types/database'

export interface UsuarioListado {
  id: string
  nombre: string | null
  rol: Role
  activo: boolean
  created_at: string
}

export type UsuarioResultado = { ok: true } | { ok: false; error: string }

export const crearUsuarioSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido'),
  email: z.string().trim().email('Correo inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  rol: z.enum(ALL_ROLES as [Role, ...Role[]]),
})

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>
