import { Bell } from 'lucide-react'

export function Header() {
  return (
    <header className="flex items-center justify-end gap-4 border-b border-border bg-card px-6 py-3">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />
      </button>
    </header>
  )
}
