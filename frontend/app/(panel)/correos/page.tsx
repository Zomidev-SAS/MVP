import { AlertCircle } from 'lucide-react'
import { RoleGuard } from '@/components/shared/RoleGuard'
import { EmptyState } from '@/components/shared/EmptyState'
import { fetchCorreosEnviados } from '@/lib/supabase/correos-actions'
import { CorreosTable } from '@/components/correos/CorreosTable'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { getCurrentProfile } from '@/lib/supabase/get-current-profile'
import type { CorreoEnviado } from '@/lib/types/correos'

export default function CorreosPage() {
  return (
    <RoleGuard allowed={ROUTE_PERMISSIONS.correos}>
      <CorreosContent />
    </RoleGuard>
  )
}

async function CorreosContent() {
  const result = await getCurrentProfile()
  const puedeReenviar = result.status === 'authenticated' && result.profile.rol === 'supervisor'

  let correos: CorreoEnviado[] | null = null
  try {
    correos = await fetchCorreosEnviados()
  } catch (error) {
    // Si cola_correos no existe todavía en este entorno (migración 038 sin
    // aplicar) o la consulta falla, se degrada a un aviso en vez de tumbar
    // toda la pantalla.
    console.error('Error al cargar correos:', error)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Correos enviados</h1>
      {correos === null ? (
        <EmptyState
          icon={AlertCircle}
          title="Correos no disponibles"
          description="No se pudo cargar el historial de correos. Intenta de nuevo más tarde."
        />
      ) : (
        <CorreosTable correos={correos} puedeReenviar={puedeReenviar} />
      )}
    </div>
  )
}
