// frontend/components/dashboard/charts/StockPorBodegaChart.tsx
'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/EmptyState'
import { Warehouse } from 'lucide-react'
import { ChartExportMenu } from '@/components/dashboard/ChartExportMenu'
import type { StockPorBodegaPunto } from '@/lib/types/dashboard-graficas'

const chartConfig = {
  cantidad: { label: 'Cantidad', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function StockPorBodegaChart({ data }: { data: StockPorBodegaPunto[] }) {
  if (data.length === 0) {
    return <EmptyState icon={Warehouse} title="Sin datos de stock por bodega" />
  }
  return (
    <div id="chart-stock-bodega" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Stock por bodega</h3>
        <ChartExportMenu targetId="chart-stock-bodega" data={data} nombreArchivo="chart-stock-bodega" />
      </div>
      <ChartContainer config={chartConfig} className="h-[280px] w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" />
          <YAxis type="category" dataKey="bodega" width={100} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="cantidad" fill="var(--color-cantidad)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
