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
import type { Role } from '@/lib/types/database'

export type RouteKey =
  | 'dashboard'
  | 'inventario'
  | 'movimientos'
  | 'entradas'
  | 'ajustes'
  | 'importar'
  | 'usuarios'

const ALL_ROLES: Role[] = [
  'supervisor',
  'comercial',
  'ingenieria',
  'produccion',
  'compras',
  'auditoria',
  'lectura',
]

export const ROUTE_PERMISSIONS: Record<RouteKey, Role[]> = {
  dashboard: ALL_ROLES,
  inventario: ALL_ROLES,
  movimientos: ['supervisor', 'ingenieria', 'auditoria'],
  entradas: ['supervisor', 'produccion', 'compras'],
  ajustes: ['supervisor', 'produccion', 'compras'],
  importar: ['supervisor', 'compras'],
  usuarios: ['supervisor'],
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
