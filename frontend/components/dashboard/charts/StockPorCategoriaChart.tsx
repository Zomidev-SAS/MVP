// frontend/components/dashboard/charts/StockPorCategoriaChart.tsx
'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/EmptyState'
import { Tags } from 'lucide-react'
import { ChartExportMenu } from '@/components/dashboard/ChartExportMenu'
import { formatCompactNumero, truncarEtiqueta } from '@/lib/format'
import type { StockPorCategoriaPunto } from '@/lib/types/dashboard-graficas'

const chartConfig = {
  cantidad: { label: 'Cantidad', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function StockPorCategoriaChart({ data }: { data: StockPorCategoriaPunto[] }) {
  if (data.length === 0) {
    return <EmptyState icon={Tags} title="Sin datos de stock por categoría" />
  }
  return (
    <div id="chart-stock-categoria" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Stock por categoría</h3>
        <ChartExportMenu targetId="chart-stock-categoria" data={data} nombreArchivo="chart-stock-categoria" />
      </div>
      <ChartContainer config={chartConfig} className="h-[280px] w-full">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickFormatter={formatCompactNumero} />
          <YAxis
            type="category"
            dataKey="categoria"
            width={110}
            interval={0}
            tickFormatter={truncarEtiqueta}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="cantidad" fill="var(--color-cantidad)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
