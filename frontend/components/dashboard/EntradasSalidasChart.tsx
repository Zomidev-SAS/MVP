'use client'

import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { ChartExportMenu } from '@/components/dashboard/ChartExportMenu'
import type { EntradaSalidaDia } from '@/lib/types/dashboard'

const chartConfig = {
  entradas: { label: 'Entradas', color: 'var(--chart-1)' },
  salidas: { label: 'Salidas', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function EntradasSalidasChart({ data }: { data: EntradaSalidaDia[] }) {
  return (
    <div id="chart-entradas-salidas" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Entradas vs Salidas (últimos 7 días)</h3>
        <ChartExportMenu targetId="chart-entradas-salidas" data={data} nombreArchivo="chart-entradas-salidas" />
      </div>
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
    </div>
  )
}
