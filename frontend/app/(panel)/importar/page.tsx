import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { CsvImportForm } from '@/components/importar/CsvImportForm'

export default function ImportarPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.importar}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Importar CSV</h1>
          <p className="text-muted-foreground">Carga masiva de entradas de inventario</p>
        </div>
        <CsvImportForm />
      </div>
    </RoleGuard>
  )
}
