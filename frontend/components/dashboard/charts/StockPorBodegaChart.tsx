// frontend/components/dashboard/charts/StockPorBodegaChart.tsx
'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/EmptyState'
import { Warehouse } from 'lucide-react'
import { ChartExportMenu } from '@/components/dashboard/ChartExportMenu'
import { formatCompactNumero } from '@/lib/format'
import type { StockPorBodegaPunto } from '@/lib/types/dashboard-graficas'

const chartConfig = {
  cantidad: { label: 'Cantidad', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function StockPorBodegaChart({ data }: { data: StockPorBodegaPunto[] }) {
  if (data.length === 0) {
    return <EmptyState icon={Warehouse} title="Sin datos de stock por bodega" />
  }
  // Más bodegas = más filas apretadas con nombres cortados; la altura crece
  // con la cantidad de barras en vez de quedar fija en 280px.
  const altura = Math.max(280, data.length * 32 + 60)
  return (
    <div id="chart-stock-bodega" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Stock por bodega</h3>
        <ChartExportMenu targetId="chart-stock-bodega" data={data} nombreArchivo="chart-stock-bodega" />
      </div>
      <ChartContainer config={chartConfig} className="w-full" style={{ height: altura }}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickFormatter={formatCompactNumero} />
          <YAxis type="category" dataKey="bodega" width={170} interval={0} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="cantidad" fill="var(--color-cantidad)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
