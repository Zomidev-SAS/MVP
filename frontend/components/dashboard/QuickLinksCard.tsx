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
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {enlaces.map((enlace) => {
          const Icon = enlace.icon
          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              className="flex flex-col items-center gap-2 rounded-md border p-4 text-center text-sm transition-colors hover:bg-accent"
            >
              <Icon className="h-5 w-5 text-primary" />
              {enlace.label}
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
