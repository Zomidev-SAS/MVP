// frontend/components/dashboard/charts/VehiculosPorEtapaChart.tsx
'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/EmptyState'
import { Car } from 'lucide-react'
import type { VehiculoPorEtapaPunto } from '@/lib/types/dashboard-graficas'

const chartConfig = {
  cantidad: { label: 'Vehículos', color: 'var(--chart-4)' },
} satisfies ChartConfig

export function VehiculosPorEtapaChart({ data }: { data: VehiculoPorEtapaPunto[] }) {
  if (data.length === 0) {
    return <EmptyState icon={Car} title="Sin vehículos en proceso" />
  }
  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="etapa" tickLine={false} axisLine={false} />
        <YAxis />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => [
                `${value} vehículos · ${(item.payload as VehiculoPorEtapaPunto).tiempoPromedioDias.toFixed(1)} días promedio`,
                '',
              ]}
            />
          }
        />
        <Bar dataKey="cantidad" fill="var(--color-cantidad)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
