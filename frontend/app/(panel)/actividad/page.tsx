import { AlertCircle } from 'lucide-react'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { EmptyState } from '@/components/shared/EmptyState'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { fetchActividad } from '@/lib/supabase/actividad-actions'
import { ActividadTimeline } from '@/components/actividad/ActividadTimeline'
import type { EventoActividad } from '@/lib/types/actividad'

export default function ActividadPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.actividad}>
      <ActividadContent />
    </RoleGuard>
  )
}

async function ActividadContent() {
  let eventos: EventoActividad[] | null = null
  try {
    eventos = await fetchActividad()
  } catch (error) {
    // Si eventos_sistema no existe todavía en este entorno (migración 031 sin
    // aplicar) o la consulta falla, se degrada a un aviso en vez de propagar
    // el error a app/(panel)/error.tsx y tumbar toda la pantalla.
    console.error('Error al cargar actividad:', error)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Actividad en vivo</h1>
      {eventos === null ? (
        <EmptyState
          icon={AlertCircle}
          title="Actividad no disponible"
          description="No se pudo cargar el registro de actividad. Intenta de nuevo más tarde."
        />
      ) : (
        <ActividadTimeline eventos={eventos} />
      )}
    </div>
  )
}
