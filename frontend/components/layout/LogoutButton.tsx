'use client'

import { LogOut } from 'lucide-react'
import { useLogout } from '@/lib/hooks/use-logout'

export function LogoutButton() {
  const { logout, loading } = useLogout()

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="flex w-full items-center gap-2 text-left text-sm text-destructive"
    >
      <LogOut className="h-4 w-4" />
      {loading ? 'Cerrando sesión...' : 'Cerrar sesión'}
    </button>
  )
}
