// frontend/components/dashboard/charts/AjustesOCPorEstadoChart.tsx
'use client'

import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/EmptyState'
import { ClipboardList } from 'lucide-react'
import { ChartExportMenu } from '@/components/dashboard/ChartExportMenu'
import type { AjusteOCPorEstadoPunto } from '@/lib/types/dashboard-graficas'

const chartConfig = {
  ajuste: { label: 'Ajustes', color: 'var(--chart-1)' },
  orden_compra: { label: 'Órdenes de compra', color: 'var(--chart-5)' },
} satisfies ChartConfig

export function AjustesOCPorEstadoChart({ data }: { data: AjusteOCPorEstadoPunto[] }) {
  const porEstado = useMemo(() => {
    const estados = Array.from(new Set(data.map((d) => d.estado)))
    return estados.map((estado) => {
      const fila: Record<string, string | number> = { estado }
      for (const punto of data.filter((d) => d.estado === estado)) {
        fila[punto.tipo] = punto.cantidad
      }
      return fila
    })
  }, [data])

  if (data.length === 0) {
    return <EmptyState icon={ClipboardList} title="Sin ajustes ni órdenes en el periodo" />
  }

  return (
    <div id="chart-ajustes-oc" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Ajustes y OC por estado</h3>
        <ChartExportMenu targetId="chart-ajustes-oc" data={data} nombreArchivo="chart-ajustes-oc" />
      </div>
      <ChartContainer config={chartConfig} className="h-[280px] w-full">
        <BarChart data={porEstado}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="estado" tickLine={false} axisLine={false} />
          <YAxis />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="ajuste" fill="var(--color-ajuste)" radius={4} stackId="a" />
          <Bar dataKey="orden_compra" fill="var(--color-orden_compra)" radius={4} stackId="a" />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
