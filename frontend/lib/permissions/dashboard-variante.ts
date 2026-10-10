import type { Role } from '@/lib/types/database'

export type DashboardVariante =
  | 'completo'
  | 'comercial'
  | 'compras'
  | 'taller'
  | 'instalacion'
  | 'bitacora'
  | 'basico'

export const VARIANTE_POR_ROL: Record<Role, DashboardVariante> = {
  supervisor: 'completo',
  comercial: 'comercial',
  compras: 'compras',
  produccion: 'taller',
  metalmecanica: 'taller',
  instalacion: 'instalacion',
  auditoria: 'bitacora',
  lectura: 'basico',
}
