'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import type { Role } from '@/lib/types/database'
import { cn } from '@/lib/utils'

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => ROUTE_PERMISSIONS[item.key].includes(role))

  return (
    <aside className="flex w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-center border-b border-sidebar-border p-4">
        <Image
          src="/logo.jpeg"
          alt="Carrera Arango"
          width={140}
          height={80}
          className="h-auto w-full max-w-[140px]"
        />
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
