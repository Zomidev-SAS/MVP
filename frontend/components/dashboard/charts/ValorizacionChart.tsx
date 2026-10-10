// frontend/components/dashboard/charts/ValorizacionChart.tsx
'use client'

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/EmptyState'
import { TrendingUp } from 'lucide-react'
import type { ValorizacionPunto } from '@/lib/types/dashboard-graficas'

const chartConfig = {
  valorCop: { label: 'Valorización', color: 'var(--chart-2)' },
} satisfies ChartConfig

const formatoCop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const formatoFecha = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' })

export function ValorizacionChart({ data }: { data: ValorizacionPunto[] | null }) {
  if (!data || data.length === 0) {
    return <EmptyState icon={TrendingUp} title="Sin datos de valorización" />
  }
  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <LineChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="fecha" tickFormatter={(v) => formatoFecha.format(new Date(v))} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(v) => formatoCop.format(v)} width={90} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(v) => formatoFecha.format(new Date(v as string))}
              formatter={(value) => [formatoCop.format(value as number), 'Valorización']}
            />
          }
        />
        <Line type="monotone" dataKey="valorCop" stroke="var(--color-valorCop)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  )
}
