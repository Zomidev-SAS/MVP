import { RoleGuard } from '@/components/shared/RoleGuard'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { CsvImportForm } from '@/components/importar/CsvImportForm'
import { InventarioExcelImport } from '@/components/importar/InventarioExcelImport'

export default function ImportarPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.importar}>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Importar</h1>
          <p className="text-muted-foreground">
            Publica inventario para todo el equipo o importa entradas puntuales
          </p>
        </div>
        <InventarioExcelImport />
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Entradas CSV</h2>
            <p className="text-sm text-muted-foreground">Carga masiva de movimientos de inventario</p>
          </div>
          <CsvImportForm />
        </div>
      </div>
    </RoleGuard>
  )
}
