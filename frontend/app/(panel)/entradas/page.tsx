import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { EntryForm } from '@/components/entradas/EntryForm'

export default function EntradasPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.entradas}>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Nueva Entrada</h1>
        <EntryForm />
      </div>
    </RoleGuard>
  )
}
