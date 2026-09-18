export type Role =
  | 'supervisor'
  | 'comercial'
  | 'metalmecanica'
  | 'produccion'
  | 'instalacion'
  | 'compras'
  | 'auditoria'
  | 'lectura'

const ROLE_SET: Record<Role, true> = {
  supervisor: true,
  comercial: true,
  metalmecanica: true,
  produccion: true,
  instalacion: true,
  compras: true,
  auditoria: true,
  lectura: true,
}

export const ROLE_LABELS: Record<Role, string> = {
  supervisor: 'Supervisor',
  comercial: 'Comercial',
  metalmecanica: 'Metalmecánica',
  produccion: 'Producción',
  instalacion: 'Instalación',
  compras: 'Compras',
  auditoria: 'Auditoría',
  lectura: 'Solo lectura',
}

export const ALL_ROLES: readonly Role[] = Object.keys(ROLE_SET) as Role[]

export interface Profile {
  id: string
  nombre: string | null
  rol: Role
  activo: boolean
}
