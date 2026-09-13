import { RoleGuard } from '@/components/shared/RoleGuard'
import { FormulariosTable } from '@/components/formularios/FormulariosTable'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'

export default function FormulariosPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.formularios}>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Formularios</h1>
          <p className="text-sm text-muted-foreground">
            Entradas y salidas de la app. Desliza la tabla horizontalmente para ver todo.
          </p>
        </div>
        <FormulariosTable />
      </div>
    </RoleGuard>
  )
}
