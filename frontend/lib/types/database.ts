export type Role =
  | 'supervisor'
  | 'comercial'
  | 'ingenieria'
  | 'produccion'
  | 'compras'
  | 'auditoria'
  | 'lectura'

const ROLE_SET: Record<Role, true> = {
  supervisor: true,
  comercial: true,
  ingenieria: true,
  produccion: true,
  compras: true,
  auditoria: true,
  lectura: true,
}

export const ALL_ROLES: readonly Role[] = Object.keys(ROLE_SET) as Role[]

export interface Profile {
  id: string
  nombre: string | null
  rol: Role
}
