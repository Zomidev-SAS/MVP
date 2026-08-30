import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  FilePlus,
  SlidersHorizontal,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { ALL_ROLES, type Role } from '@/lib/types/database'

export type RouteKey =
  | 'dashboard'
  | 'inventario'
  | 'movimientos'
  | 'entradas'
  | 'ajustes'
  | 'importar'
  | 'usuarios'

export const ROUTE_PERMISSIONS: Record<RouteKey, readonly Role[]> = {
  dashboard: ALL_ROLES,
  inventario: ALL_ROLES,
  movimientos: ['supervisor', 'ingenieria', 'auditoria'] as const,
  entradas: ['supervisor', 'produccion', 'compras'] as const,
  ajustes: ['supervisor', 'produccion', 'compras'] as const,
  importar: ['supervisor', 'compras'] as const,
  usuarios: ['supervisor'] as const,
}

export const NAV_ITEMS: {
  key: RouteKey
  label: string
  href: string
  icon: LucideIcon
}[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { key: 'inventario', label: 'Inventario', href: '/inventario', icon: Package },
  { key: 'movimientos', label: 'Movimientos', href: '/movimientos', icon: ArrowLeftRight },
  { key: 'entradas', label: 'Entradas', href: '/entradas', icon: FilePlus },
  { key: 'ajustes', label: 'Ajustes', href: '/ajustes', icon: SlidersHorizontal },
  { key: 'importar', label: 'Importar CSV', href: '/importar', icon: Upload },
  { key: 'usuarios', label: 'Usuarios', href: '/usuarios', icon: Users },
]
