import { Bell } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function Header({
  ajustesPendientes,
  stockBajo,
}: {
  ajustesPendientes?: number
  stockBajo?: number
}) {
  const items: string[] = []
  if (ajustesPendientes && ajustesPendientes > 0) {
    items.push(
      `${ajustesPendientes} ajuste${ajustesPendientes === 1 ? '' : 's'} pendiente${
        ajustesPendientes === 1 ? '' : 's'
      } de tu aprobación.`
    )
  }
  if (stockBajo && stockBajo > 0) {
    items.push(`${stockBajo} producto${stockBajo === 1 ? '' : 's'} con stock bajo.`)
  }

  return (
    <header className="flex items-center justify-end gap-4 border-b border-border bg-card px-6 py-3">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="relative text-muted-foreground hover:text-foreground"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
          {items.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {items.length}
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <p className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
            Notificaciones
          </p>
          <DropdownMenuSeparator />
          {items.length === 0 ? (
            <p className="px-1.5 py-6 text-center text-sm text-muted-foreground">
              No tienes notificaciones.
            </p>
          ) : (
            <ul className="space-y-1 px-1.5 py-2">
              {items.map((texto, i) => (
                <li key={i} className="rounded-md px-1.5 py-1.5 text-sm">
                  {texto}
                </li>
              ))}
            </ul>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
