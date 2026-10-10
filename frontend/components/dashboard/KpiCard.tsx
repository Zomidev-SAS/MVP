import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AnimatedNumber } from '@/components/dashboard/AnimatedNumber'

export function KpiCard({
  label,
  value,
  format = 'number',
  icon: Icon,
}: {
  label: string
  value: number
  format?: 'number' | 'currency'
  icon: LucideIcon
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon aria-hidden="true" className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          <AnimatedNumber value={value} format={format} />
        </div>
      </CardContent>
    </Card>
  )
}
