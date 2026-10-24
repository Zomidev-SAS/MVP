import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AnimatedNumber } from '@/components/dashboard/AnimatedNumber'
import { cn } from '@/lib/utils'

export function KpiCard({
  label,
  value,
  format = 'number',
  icon: Icon,
  href,
  alerta = false,
}: {
  label: string
  value: number
  format?: 'number' | 'currency'
  icon: LucideIcon
  href?: string
  alerta?: boolean
}) {
  const card = (
    <Card
      className={cn(
        'min-w-0',
        href && 'transition-colors hover:bg-muted/50',
        alerta && 'border-destructive/50'
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="min-w-0 truncate text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon
          aria-hidden="true"
          className={cn('h-4 w-4 shrink-0', alerta ? 'text-destructive' : 'text-primary')}
        />
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold break-words', alerta && 'text-destructive')}>
          <AnimatedNumber value={value} format={format} />
        </div>
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
