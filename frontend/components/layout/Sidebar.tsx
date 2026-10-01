'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { NAV_ITEMS, NAV_GROUPS, ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { useLogout } from '@/lib/hooks/use-logout'
import { cn, getInitials } from '@/lib/utils'
import type { Profile } from '@/lib/types/database'

export function Sidebar({
  profile,
  ajustesPendientes,
}: {
  profile: Profile
  ajustesPendientes?: number
}) {
  const pathname = usePathname()
  const { logout, loading } = useLogout()
  const items = NAV_ITEMS.filter((item) => ROUTE_PERMISSIONS[item.key].includes(profile.rol))
  const itemsByKey = new Map(items.map((item) => [item.key, item]))
  const groups = NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.keys.map((key) => itemsByKey.get(key)).filter((item): item is (typeof items)[number] => !!item),
  })).filter((group) => group.items.length > 0)

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex flex-col items-center gap-2 border-b border-sidebar-border p-4">
        <Image
          src="/logo_fondo.jpeg"
          alt="Carrera Arango"
          width={553}
          height={781}
          className="h-20 w-auto object-contain"
        />
        <div className="text-center">
          <p className="text-sm font-bold leading-tight text-sidebar-foreground">
            Carrera Arango
          </p>
          <p className="text-xs font-semibold uppercase leading-tight tracking-wide text-primary">
            Transformaciones
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-[10px] text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50">
              {group.label}
            </p>
            {group.items.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md border-l-2 py-2 pl-[10px] pr-3 text-sm transition-all duration-200 ease-in-out active:scale-[0.98]',
                    isActive
                      ? 'border-primary bg-sidebar-accent text-sidebar-foreground'
                      : 'border-transparent text-sidebar-foreground hover:bg-sidebar-accent'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.key === 'ajustes' && !!ajustesPendientes && ajustesPendientes > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground">
                      {ajustesPendientes}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/cuenta"
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-2 transition-colors hover:bg-sidebar-accent',
            pathname === '/cuenta' && 'bg-sidebar-accent'
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium text-sidebar-foreground">
            {getInitials(profile.nombre)}
          </div>
          <div className="min-w-0 flex-1 text-left text-sm">
            <p className="truncate font-medium leading-none text-sidebar-foreground">
              {profile.nombre ?? 'Usuario'}
            </p>
            <p className="text-xs capitalize text-sidebar-foreground/70">{profile.rol}</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={logout}
          disabled={loading}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          {loading ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </button>
      </div>
    </aside>
  )
}
