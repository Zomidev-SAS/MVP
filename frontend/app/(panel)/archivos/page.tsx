import { RoleGuard } from '@/components/shared/RoleGuard'
import { ArchivosExplorer } from '@/components/archivos/ArchivosExplorer'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'

export default function ArchivosPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.archivos}>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Archivos</h1>
          <p className="text-sm text-muted-foreground">
            Documentos de la empresa por departamento. Ves y subes solo en las carpetas que tu rol
            permite; borrar es exclusivo del supervisor.
          </p>
        </div>
        <ArchivosExplorer />
      </div>
    </RoleGuard>
  )
}
