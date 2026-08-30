export type Role =
  | 'supervisor'
  | 'comercial'
  | 'ingenieria'
  | 'produccion'
  | 'compras'
  | 'auditoria'
  | 'lectura'

export interface Profile {
  id: string
  full_name: string | null
  role: Role
}
