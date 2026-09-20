import { Package, ArrowLeftRight, AlertTriangle, DollarSign } from 'lucide-react'
import { formatCOP, formatNumber } from '@/lib/format'
import { CAN_VIEW_COSTS } from '@/lib/permissions/roles'
import type { DashboardVariante } from '@/lib/permissions/dashboard-variante'
import type { DashboardData } from '@/lib/types/dashboard'
import type { Role } from '@/lib/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UltimosMovimientosTable } from '@/components/dashboard/UltimosMovimientosTable'

export const PANELES_VISUALIZACION: {
  rol: Role
  label: string
  variante: DashboardVariante
}[] = [
  { rol: 'supervisor', label: 'Supervisor', variante: 'completo' },
  { rol: 'comercial', label: 'Comercial', variante: 'comercial' },
  { rol: 'compras', label: 'Compras', variante: 'compras' },
  { rol: 'metalmecanica', label: 'Metalmecánica', variante: 'taller' },
  { rol: 'produccion', label: 'Producción', variante: 'taller' },
  { rol: 'instalacion', label: 'Instalación', variante: 'instalacion' },
  { rol: 'auditoria', label: 'Auditoría', variante: 'bitacora' },
]

export function VisualizacionRolePanel({
  label,
  rol,
  variante,
  data,
}: {
  label: string
  rol: Role
  variante: DashboardVariante
  data: DashboardData
}) {
  const puedeVerCostos = CAN_VIEW_COSTS.includes(rol)
  const limiteMov = variante === 'bitacora' ? 5 : 3

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{label}</CardTitle>
        <p className="text-xs capitalize text-muted-foreground">Vista rol · {rol}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden text-sm">
        <div className="grid grid-cols-2 gap-2">
          <MiniKpi icon={Package} label="Unidades" value={formatNumber(data.totalUnidades)} />
          {puedeVerCostos && (
            <MiniKpi icon={DollarSign} label="Valor" value={formatCOP(data.valorTotal)} compact />
          )}
          {variante !== 'basico' && (
            <MiniKpi icon={ArrowLeftRight} label="Hoy" value={formatNumber(data.movimientosHoy)} />
          )}
          <MiniKpi icon={AlertTriangle} label="Stock bajo" value={formatNumber(data.stockBajo)} />
        </div>
        {variante !== 'basico' && (
          <div className="min-h-0 flex-1 overflow-auto">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Últimos movimientos</p>
            <UltimosMovimientosTable movimientos={data.ultimosMovimientos.slice(0, limiteMov)} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MiniKpi({
  icon: Icon,
  label,
  value,
  compact,
}: {
  icon: typeof Package
  label: string
  value: string
  compact?: boolean
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>{value}</p>
    </div>
  )
}
