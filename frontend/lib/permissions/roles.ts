import {
  LayoutDashboard,
  Package,
  Car,
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
  | 'vehiculos'
  | 'movimientos'
  | 'formularios'
  | 'entradas'
  | 'ajustes'
  | 'importar'
  | 'usuarios'
  | 'configuracion'

export const ROUTE_PERMISSIONS: Record<RouteKey, readonly Role[]> = {
  dashboard: ALL_ROLES,
  inventario: ALL_ROLES,
  vehiculos: ALL_ROLES,
  movimientos: ['supervisor', 'ingenieria', 'auditoria'] as const,
  formularios: ALL_ROLES,
  entradas: ['supervisor', 'produccion', 'compras'] as const,
  ajustes: ['supervisor', 'produccion', 'compras'] as const,
  importar: ['supervisor', 'compras'] as const,
  usuarios: ['supervisor'] as const,
  configuracion: ['supervisor'] as const,
}

/** Roles que pueden ver valor_unitario/valor_total en cualquier pantalla. */
export const CAN_VIEW_COSTS: readonly Role[] = ['supervisor', 'compras', 'auditoria']

export const NAV_ITEMS: {
  key: RouteKey
  label: string
  href: string
  icon: LucideIcon
}[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { key: 'inventario', label: 'Inventario', href: '/inventario', icon: Package },
  { key: 'vehiculos', label: 'Vehículos (VIN)', href: '/vehiculos', icon: Car },
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
