import { RoleGuard } from '@/components/shared/RoleGuard'
import { fetchAutomatizaciones } from '@/lib/supabase/automatizaciones-actions'
import { AutomatizacionCard } from '@/components/automatizaciones/AutomatizacionCard'

export default async function AutomatizacionesPage() {
  const jobs = await fetchAutomatizaciones()
  return (
    <RoleGuard allowed={['supervisor']}>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Automatizaciones</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <AutomatizacionCard key={job.id} job={job} />
          ))}
        </div>
      </div>
    </RoleGuard>
  )
}
