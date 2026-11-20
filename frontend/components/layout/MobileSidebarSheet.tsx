'use client'

import { useState } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types/database'
import { SidebarContent } from '@/components/layout/Sidebar'

export function MobileSidebarSheet({
  profile,
  ajustesPendientes,
}: {
  profile: Profile
  ajustesPendientes?: number
}) {
  const [open, setOpen] = useState(false)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú" />}
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col shadow-xl outline-none',
            'duration-200 data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left'
          )}
        >
          <DialogPrimitive.Title className="sr-only">Menú de navegación</DialogPrimitive.Title>
          <SidebarContent
            profile={profile}
            ajustesPendientes={ajustesPendientes}
            onNavigate={() => setOpen(false)}
          />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
