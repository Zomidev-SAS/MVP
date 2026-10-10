// frontend/components/dashboard/charts/IndicadorCard.tsx
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { IndicadorKpi } from '@/lib/types/dashboard-graficas'

function formatearValor(valor: number, unidad: IndicadorKpi['unidad']): string {
  if (unidad === 'cop') {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor)
  }
  if (unidad === 'porcentaje') return `${valor.toFixed(1)}%`
  if (unidad === 'dias') return `${valor.toFixed(1)} días`
  return new Intl.NumberFormat('es-CO').format(valor)
}

export function IndicadorCard({ kpi }: { kpi: IndicadorKpi }) {
  const variacion = kpi.variacionPct
  const esPositivo = variacion !== null && variacion > 0
  const esNegativo = variacion !== null && variacion < 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.etiqueta}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-baseline justify-between">
        <span className="text-2xl font-semibold">{formatearValor(kpi.valor, kpi.unidad)}</span>
        {variacion !== null && (
          <span
            className={`flex items-center gap-1 text-xs font-medium ${
              esPositivo ? 'text-success' : esNegativo ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {esPositivo ? <ArrowUpRight className="h-3 w-3" /> : esNegativo ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {Math.abs(variacion).toFixed(1)}%
          </span>
        )}
      </CardContent>
    </Card>
  )
}
