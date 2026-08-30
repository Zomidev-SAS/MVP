'use client'

import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { EntradaSalidaDia } from '@/lib/types/dashboard'

const chartConfig = {
  entradas: { label: 'Entradas', color: 'var(--primary)' },
  salidas: { label: 'Salidas', color: 'var(--muted-foreground)' },
} satisfies ChartConfig

export function EntradasSalidasChart({ data }: { data: EntradaSalidaDia[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="fecha"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: string) => value.slice(5)}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="entradas" fill="var(--color-entradas)" radius={4} />
        <Bar dataKey="salidas" fill="var(--color-salidas)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
