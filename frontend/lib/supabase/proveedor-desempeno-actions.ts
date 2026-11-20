'use server'

import { requireRole } from '@/lib/auth/require-role'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { esMigracionPendiente } from '@/lib/proveedores/errores'
import { createClient } from '@/lib/supabase/server'
import {
  guardarDesempenoSchema,
  type DesempenoResultado,
  type GuardarDesempenoInput,
} from '@/lib/types/proveedor-desempeno'

const MENSAJE_MIGRACION = 'Falta aplicar la migración 081 en Supabase para guardar el desempeño.'

function vacioANull(valor: string): string | null {
  const limpio = valor.trim()
  return limpio === '' ? null : limpio
}

/**
 * Guarda el desempeño de una OC del panel (por ordenId) o de una OC histórica importada
 * (por numeroOc). Las fechas y la factura vacías vuelven a tomarse de la OC.
 */
export async function guardarDesempeno(
  proveedorId: number,
  ordenId: number | null,
  numeroOc: string | null,
  input: GuardarDesempenoInput
): Promise<DesempenoResultado> {
  const parsed = guardarDesempenoSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
  }
  if (!Number.isInteger(proveedorId) || proveedorId <= 0 || (ordenId == null && !numeroOc?.trim())) {
    return { ok: false, error: 'Orden inválida.' }
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.proveedores)
  if (!auth.ok) return { ok: false, error: auth.error }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return { ok: true }
  }

  const datos = parsed.data
  const payload = {
    calidad: datos.calidad,
    calidad_comentario: vacioANull(datos.calidad_comentario),
    devoluciones: datos.devoluciones,
    devoluciones_detalle: vacioANull(datos.devoluciones_detalle),
    cantidad_observaciones: vacioANull(datos.cantidad_observaciones),
    pagos_acordados: vacioANull(datos.pagos_acordados),
    tiempo_observaciones: vacioANull(datos.tiempo_observaciones),
    observaciones: vacioANull(datos.observaciones),
    fecha_entrega_prometida: vacioANull(datos.fecha_entrega_prometida),
    fecha_entrega_real: vacioANull(datos.fecha_entrega_real),
    factura_remision: vacioANull(datos.factura_remision),
  }

  const supabase = await createClient()

  let consulta = supabase.from('proveedor_desempeno').select('id').eq('proveedor_id', proveedorId)
  consulta =
    ordenId != null
      ? consulta.eq('orden_id', ordenId)
      : consulta.is('orden_id', null).ilike('numero_oc', numeroOc!.trim().replace(/[%_\\]/g, '\\$&'))

  const { data: existente, error: errorBusqueda } = await consulta.maybeSingle()
  if (errorBusqueda) {
    if (esMigracionPendiente(errorBusqueda)) return { ok: false, error: MENSAJE_MIGRACION }
    console.error('Failed to look up proveedor_desempeno:', errorBusqueda)
    return { ok: false, error: 'No se pudo guardar el desempeño.' }
  }

  const { error } = existente
    ? await supabase
        .from('proveedor_desempeno')
        .update(payload)
        .eq('id', (existente as { id: number }).id)
    : await supabase
        .from('proveedor_desempeno')
        .insert({ ...payload, proveedor_id: proveedorId, orden_id: ordenId, numero_oc: numeroOc })

  if (error) {
    if (esMigracionPendiente(error)) return { ok: false, error: MENSAJE_MIGRACION }
    console.error('Failed to save proveedor_desempeno:', error)
    return { ok: false, error: 'No se pudo guardar el desempeño.' }
  }

  return { ok: true }
}
