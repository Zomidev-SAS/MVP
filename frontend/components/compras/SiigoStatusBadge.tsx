import { Badge } from '@/components/ui/badge'
import type { EstadoSyncSiigo } from '@/lib/types/siigo'

export const ETIQUETA_SIIGO_SYNC: Record<EstadoSyncSiigo, string> = {
  pendiente: 'Pendiente',
  enviando: 'Enviando…',
  sincronizada: 'Sincronizada',
  error: 'Error',
}

const CONFIG: Record<EstadoSyncSiigo, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  pendiente: { label: ETIQUETA_SIIGO_SYNC.pendiente, variant: 'secondary' },
  enviando: { label: ETIQUETA_SIIGO_SYNC.enviando, variant: 'secondary' },
  sincronizada: { label: ETIQUETA_SIIGO_SYNC.sincronizada, variant: 'default' },
  error: { label: ETIQUETA_SIIGO_SYNC.error, variant: 'destructive' },
}

export function SiigoStatusBadge({ estado }: { estado: EstadoSyncSiigo }) {
  const { label, variant } = CONFIG[estado]
  return <Badge variant={variant}>{label}</Badge>
}
