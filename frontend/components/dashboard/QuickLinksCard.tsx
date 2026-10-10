import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function QuickLinksCard({
  titulo = 'Accesos rápidos',
  enlaces,
}: {
  titulo?: string
  enlaces: { label: string; href: string; icon: LucideIcon }[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      {/* flex-wrap with a fixed item width (not a grid) so a single link
          doesn't stretch to fill an empty row. */}
      <CardContent className="flex flex-wrap gap-3">
        {enlaces.map((enlace) => {
          const Icon = enlace.icon
          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              className="flex w-28 shrink-0 flex-col items-center gap-2 rounded-md border p-4 text-center text-sm transition-colors hover:bg-accent sm:w-32"
            >
              <Icon aria-hidden="true" className="h-5 w-5 text-primary" />
              {enlace.label}
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
