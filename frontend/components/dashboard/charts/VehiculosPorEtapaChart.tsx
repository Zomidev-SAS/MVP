// frontend/components/dashboard/charts/VehiculosPorEtapaChart.tsx
'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/EmptyState'
import { Car } from 'lucide-react'
import { ChartExportMenu } from '@/components/dashboard/ChartExportMenu'
import type { VehiculoPorEtapaPunto } from '@/lib/types/dashboard-graficas'

const chartConfig = {
  cantidad: { label: 'Vehículos', color: 'var(--chart-4)' },
} satisfies ChartConfig

export function VehiculosPorEtapaChart({ data }: { data: VehiculoPorEtapaPunto[] }) {
  if (data.length === 0) {
    return <EmptyState icon={Car} title="Sin vehículos en proceso" />
  }
  return (
    <div id="chart-vehiculos-etapa" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Vehículos por etapa</h3>
        <ChartExportMenu targetId="chart-vehiculos-etapa" data={data} nombreArchivo="chart-vehiculos-etapa" />
      </div>
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
    </div>
  )
}
