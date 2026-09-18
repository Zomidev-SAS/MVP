import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  FilePlus,
  SlidersHorizontal,
  Upload,
  Users,
  ClipboardList,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { ALL_ROLES, type Role } from '@/lib/types/database'

export type RouteKey =
  | 'dashboard'
  | 'inventario'
  | 'movimientos'
  | 'formularios'
  | 'entradas'
  | 'ajustes'
  | 'importar'
  | 'usuarios'
  | 'configuracion'

export const ROUTE_PERMISSIONS: Record<RouteKey, readonly Role[]> = {
  dashboard: ALL_ROLES,
  // RLS real: productos_select/mov_select_autenticados permiten leer a
  // cualquier rol activo — no hay restricción de lectura por rol.
  inventario: ALL_ROLES,
  // RLS real (mov_select_autenticados) permite leer a cualquier activo,
  // pero mantenemos la bitácora completa reservada a supervisor/auditoria
  // (el rol "ingenieria" que la usaba ya no existe en el schema real).
  movimientos: ['supervisor', 'auditoria'] as const,
  formularios: ALL_ROLES,
  // Alineado a la policy real mov_insert_roles_autorizados.
  entradas: ['supervisor', 'metalmecanica', 'produccion', 'instalacion', 'compras'] as const,
  // Alineado a la policy real ajustes_insert_roles.
  ajustes: ['supervisor', 'produccion', 'metalmecanica', 'instalacion', 'compras'] as const,
  // Alineado al chequeo de rol real en la Edge Function importar-inventario-csv.
  importar: ['supervisor', 'compras'] as const,
  usuarios: ['supervisor'] as const,
  configuracion: ['supervisor'] as const,
}

/** Roles que pueden ver valor_unitario/valor_total en cualquier pantalla — igual a la matriz real de las vistas de Supabase. */
export const CAN_VIEW_COSTS: readonly Role[] = ['supervisor', 'compras', 'auditoria']

export const NAV_ITEMS: {
  key: RouteKey
  label: string
  href: string
  icon: LucideIcon
}[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { key: 'inventario', label: 'Inventario', href: '/inventario', icon: Package },
  { key: 'movimientos', label: 'Movimientos', href: '/movimientos', icon: ArrowLeftRight },
  { key: 'formularios', label: 'Formularios', href: '/formularios', icon: ClipboardList },
  { key: 'entradas', label: 'Entradas', href: '/entradas', icon: FilePlus },
  { key: 'ajustes', label: 'Ajustes', href: '/ajustes', icon: SlidersHorizontal },
  { key: 'importar', label: 'Importar CSV', href: '/importar', icon: Upload },
  { key: 'usuarios', label: 'Usuarios', href: '/usuarios', icon: Users },
  { key: 'configuracion', label: 'Configuración', href: '/configuracion', icon: Settings },
]

/** Resuelve un pathname exacto a su RouteKey, o null si no es una ruta controlada por ROUTE_PERMISSIONS (ej. /login, /acceso-denegado). */
export function getRouteKeyForPath(pathname: string): RouteKey | null {
  const item = NAV_ITEMS.find((i) => i.href === pathname)
  return item ? item.key : null
}
