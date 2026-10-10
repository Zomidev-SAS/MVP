import { AlertCircle, CheckCircle2, Clock, CircleSlash } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { AutomatizacionEstado } from '@/lib/types/automatizaciones'

const ICONOS_RESULTADO = {
  ok: <CheckCircle2 className="h-4 w-4 text-success" />,
  error: <AlertCircle className="h-4 w-4 text-destructive" />,
  parcial: <AlertCircle className="h-4 w-4 text-warning" />,
  sin_ejecutar: <CircleSlash className="h-4 w-4 text-muted-foreground" />,
} as const

export function AutomatizacionCard({ job }: { job: AutomatizacionEstado }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{job.nombre}</CardTitle>
        {ICONOS_RESULTADO[job.resultado]}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">{job.descripcion}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> {job.horario}
        </div>
        <p className="text-xs">
          Última ejecución: {job.ultimaEjecucion ? new Date(job.ultimaEjecucion).toLocaleString('es-CO') : 'nunca'}
        </p>
        {job.error && (
          <Badge variant="destructive" className="w-fit text-xs font-normal">
            {job.error}
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}
