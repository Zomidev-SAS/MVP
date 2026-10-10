import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { CsvImportForm } from '@/components/importar/CsvImportForm'

export default function ImportarPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.importar}>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Importar entradas CSV</h1>
          <p className="text-muted-foreground">Carga masiva de movimientos de inventario</p>
        </div>
        <CsvImportForm />
      </div>
    </RoleGuard>
  )
}
