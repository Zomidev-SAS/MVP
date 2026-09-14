export type Role =
  | 'supervisor'
  | 'comercial'
  | 'ingenieria'
  | 'produccion'
  | 'compras'
  | 'auditoria'
  | 'lectura'
  | 'metalmecanica'
  | 'instalacion'

const ROLE_SET: Record<Role, true> = {
  supervisor: true,
  comercial: true,
  ingenieria: true,
  produccion: true,
  compras: true,
  auditoria: true,
  lectura: true,
  metalmecanica: true,
  instalacion: true,
}

export const ROLE_LABELS: Record<Role, string> = {
  supervisor: 'Supervisor',
  comercial: 'Comercial',
  ingenieria: 'Ingeniería',
  produccion: 'Producción',
  compras: 'Compras',
  auditoria: 'Auditoría',
  lectura: 'Solo lectura',
  metalmecanica: 'Metalmecánica',
  instalacion: 'Instalación',
}

export const ALL_ROLES: readonly Role[] = Object.keys(ROLE_SET) as Role[]

export interface Profile {
  id: string
  nombre: string | null
  rol: Role
}
