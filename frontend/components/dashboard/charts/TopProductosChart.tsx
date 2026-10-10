// frontend/components/dashboard/charts/TopProductosChart.tsx
'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/EmptyState'
import { Trophy } from 'lucide-react'
import { ChartExportMenu } from '@/components/dashboard/ChartExportMenu'
import type { TopProductoPunto } from '@/lib/types/dashboard-graficas'

const chartConfig = {
  cantidad: { label: 'Cantidad movida', color: 'var(--chart-3)' },
} satisfies ChartConfig

export function TopProductosChart({ data }: { data: TopProductoPunto[] }) {
  if (data.length === 0) {
    return <EmptyState icon={Trophy} title="Sin movimientos en el periodo" />
  }
  return (
    <div id="chart-top-productos" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Top 10 productos</h3>
        <ChartExportMenu targetId="chart-top-productos" data={data} nombreArchivo="chart-top-productos" />
      </div>
      <ChartContainer config={chartConfig} className="h-[320px] w-full">
        <BarChart data={data.slice(0, 10)}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="producto" tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={70} />
          <YAxis />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="cantidad" fill="var(--color-cantidad)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
