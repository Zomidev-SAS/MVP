'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { JUST_LOGGED_IN_KEY } from '@/lib/auth/just-logged-in'

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mostrarBienvenida, setMostrarBienvenida] = useState(false)

  useEffect(() => {
    if (pathname !== '/') return
    if (sessionStorage.getItem(JUST_LOGGED_IN_KEY)) {
      sessionStorage.removeItem(JUST_LOGGED_IN_KEY)
      setMostrarBienvenida(true)
    }
  }, [pathname])

  return (
    <div key={pathname} className={mostrarBienvenida ? 'dashboard-welcome' : 'page-transition'}>
      {children}
    </div>
  )
}
