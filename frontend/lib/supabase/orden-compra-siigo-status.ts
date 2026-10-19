import type { OrdenCompra } from '@/lib/types/orden-compra'
import type { SiigoSyncInfo } from '@/lib/types/siigo'

/**
 * Deriva el estado de sincronización con Siigo usando siigo_estado del DB.
 * Cuando siigo_estado es null (OC antigua sin campo), cae al cálculo legacy
 * basado en finalizada_at + siigo_referencia.
 */
export function derivarEstadoSiigo(orden: OrdenCompra): SiigoSyncInfo {
  if (orden.siigo_estado) {
    return {
      estado: orden.siigo_estado,
      referencia: orden.siigo_referencia,
      fecha: orden.finalizada_at ?? orden.descargada_siigo_at,
      error: null,
    }
  }
  // Compatibilidad con OCs anteriores a la migración 053
  if (orden.finalizada_at && orden.siigo_referencia) {
    return {
      estado: 'sincronizada',
      referencia: orden.siigo_referencia,
      fecha: orden.finalizada_at,
      error: null,
    }
  }
  return {
    estado: 'pendiente',
    referencia: orden.siigo_referencia,
    fecha: orden.descargada_siigo_at,
    error: null,
  }
}
