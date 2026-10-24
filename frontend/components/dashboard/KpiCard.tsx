import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function KpiCard({
  label,
  value,
  icon: Icon,
  href,
  alerta = false,
}: {
  label: string
  value: string
  icon: LucideIcon
  href?: string
  alerta?: boolean
}) {
  const card = (
    <Card
      className={cn(
        href && 'transition-colors hover:bg-muted/50',
        alerta && 'border-destructive/50'
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={cn('h-4 w-4', alerta ? 'text-destructive' : 'text-primary')} />
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', alerta && 'text-destructive')}>{value}</div>
      </CardContent>
    </Card>
  )
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
      {card}
    </Link>
  ) : (
    card
  )
}
