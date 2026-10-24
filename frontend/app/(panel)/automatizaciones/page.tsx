import { AlertCircle, Workflow } from 'lucide-react'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { EmptyState } from '@/components/shared/EmptyState'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { fetchAutomatizaciones } from '@/lib/supabase/automatizaciones-actions'
import { AutomatizacionCard } from '@/components/automatizaciones/AutomatizacionCard'
import type { AutomatizacionEstado } from '@/lib/types/automatizaciones'

export default function AutomatizacionesPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.automatizaciones}>
      <AutomatizacionesContent />
    </RoleGuard>
  )
}

async function AutomatizacionesContent() {
  let jobs: AutomatizacionEstado[] | null = null
  try {
    jobs = await fetchAutomatizaciones()
  } catch (error) {
    // Si vista_log_automatizaciones_ultimo_estado no existe todavía en este
    // entorno (migración 036 sin aplicar) o la consulta falla, se degrada a
    // un aviso en vez de tumbar toda la pantalla.
    console.error('Error al cargar automatizaciones:', error)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Automatizaciones</h1>
      {jobs === null ? (
        <EmptyState
          icon={AlertCircle}
          title="Automatizaciones no disponibles"
          description="No se pudo cargar el estado de las automatizaciones. Intenta de nuevo más tarde."
        />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="Sin ejecuciones registradas"
          description="Las automatizaciones aparecerán aquí cuando corran por primera vez."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <AutomatizacionCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  )
}
