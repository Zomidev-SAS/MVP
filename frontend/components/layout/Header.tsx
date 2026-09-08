import { Bell } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function Header() {
  return (
    <header className="flex items-center justify-end gap-4 border-b border-border bg-card px-6 py-3">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="text-muted-foreground hover:text-foreground"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <p className="px-1.5 py-6 text-center text-sm text-muted-foreground">
            No tienes notificaciones.
          </p>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
