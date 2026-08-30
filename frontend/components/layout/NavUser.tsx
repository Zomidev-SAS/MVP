'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useLogout } from '@/lib/hooks/use-logout'
import { ChevronDown, LogOut } from 'lucide-react'
import type { Profile } from '@/lib/types/database'

function getInitials(name: string | null): string {
  if (!name || !name.trim()) return '??'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const second = parts[1]?.[0] ?? ''
  return (first + second).toUpperCase()
}

export function NavUser({ profile }: { profile: Profile }) {
  const { logout, loading } = useLogout()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{getInitials(profile.nombre)}</AvatarFallback>
        </Avatar>
        <span className="text-left text-sm">
          <span className="block font-medium leading-none">{profile.nombre ?? 'Usuario'}</span>
          <span className="block text-xs capitalize text-muted-foreground">{profile.rol}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={logout} disabled={loading} className="text-destructive">
          <LogOut className="h-4 w-4" />
          {loading ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
