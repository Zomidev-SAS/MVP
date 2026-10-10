import { RoleGuard } from '@/components/shared/RoleGuard'
import { fetchActividad } from '@/lib/supabase/actividad-actions'
import { ActividadTimeline } from '@/components/actividad/ActividadTimeline'

export default async function ActividadPage() {
  const eventos = await fetchActividad()
  return (
    <RoleGuard allowed={['supervisor', 'auditoria']}>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Actividad en vivo</h1>
        <ActividadTimeline eventos={eventos} />
      </div>
    </RoleGuard>
  )
}
