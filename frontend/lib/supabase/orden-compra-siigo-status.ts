import type { OrdenCompra } from '@/lib/types/orden-compra'
import type { SiigoSyncInfo } from '@/lib/types/siigo'

/**
 * Deriva el estado de sincronización con Siigo a partir de columnas reales
 * de `ordenes_compra` (sin tabla/estado dedicado de sync todavía).
 *
 * 'enviando' y 'error' solo se asignan de forma optimista en el cliente
 * cuando se invoca la acción `enviarOrdenASiigo`/`reintentarEnvioSiigo` —
 * esta función pura, que solo lee datos estáticos de la BD, nunca los
 * devuelve por su cuenta.
 */
export function derivarEstadoSiigo(orden: OrdenCompra): SiigoSyncInfo {
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
