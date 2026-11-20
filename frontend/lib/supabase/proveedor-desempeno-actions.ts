'use server'

import { requireRole } from '@/lib/auth/require-role'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { esMigracionPendiente } from '@/lib/proveedores/errores'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  filaHistorialImportadaSchema,
  guardarDesempenoSchema,
  type DesempenoResultado,
  type GuardarDesempenoInput,
  type ImportarHistorialResultado,
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

const MAX_FILAS_HISTORIAL = 2000
const TAMANO_LOTE = 150

/**
 * Guarda el historial importado del cuadro de control. Si el número de orden coincide con una
 * OC del panel de este mismo proveedor, se guarda sobre esa OC; si no, queda como OC histórica.
 * Reimportar el mismo archivo actualiza en vez de duplicar.
 */
export async function importarHistorialDesempeno(
  proveedorId: number,
  filas: z.infer<typeof filaHistorialImportadaSchema>[]
): Promise<ImportarHistorialResultado> {
  if (!Number.isInteger(proveedorId) || proveedorId <= 0) {
    return { ok: false, error: 'Proveedor inválido.' }
  }
  const parsed = z.array(filaHistorialImportadaSchema).min(1).max(MAX_FILAS_HISTORIAL).safeParse(filas)
  if (!parsed.success) {
    return { ok: false, error: 'El archivo tiene filas inválidas. Vuelve a leerlo.' }
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.proveedores)
  if (!auth.ok) return { ok: false, error: auth.error }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { ok: true, creados: parsed.data.length, actualizados: 0, vinculados: 0 }
  }

  const supabase = await createClient()

  const { data: proveedor, error: errorProveedor } = await supabase
    .from('proveedores')
    .select('nit_normalizado')
    .eq('id', proveedorId)
    .maybeSingle()
  if (errorProveedor || !proveedor) {
    if (esMigracionPendiente(errorProveedor)) return { ok: false, error: MENSAJE_MIGRACION }
    return { ok: false, error: 'No se encontró el proveedor.' }
  }
  const nit = (proveedor as { nit_normalizado: string }).nit_normalizado

  // Históricas ya guardadas de este proveedor, por número de orden.
  const { data: historicas, error: errorHistoricas } = await supabase
    .from('proveedor_desempeno')
    .select('id, numero_oc')
    .eq('proveedor_id', proveedorId)
    .is('orden_id', null)
  if (errorHistoricas) {
    if (esMigracionPendiente(errorHistoricas)) return { ok: false, error: MENSAJE_MIGRACION }
    console.error('Failed to load historicas:', errorHistoricas)
    return { ok: false, error: 'No se pudo importar el historial.' }
  }
  const historicaPorNumero = new Map(
    ((historicas ?? []) as { id: number; numero_oc: string | null }[])
      .filter((h) => h.numero_oc)
      .map((h) => [h.numero_oc!.toLowerCase(), h.id])
  )

  let creados = 0
  let actualizados = 0
  let vinculados = 0

  for (let i = 0; i < parsed.data.length; i += TAMANO_LOTE) {
    const lote = parsed.data.slice(i, i + TAMANO_LOTE)

    // OC del panel con ese número que tengan líneas de este proveedor.
    const { data: ordenes } = await supabase
      .from('ordenes_compra')
      .select('id, numero_oc')
      .in('numero_oc', lote.map((f) => f.numero_oc))
    const candidatas = (ordenes ?? []) as { id: number; numero_oc: string }[]
    const ordenPorNumero = new Map<string, number>()
    if (candidatas.length > 0) {
      const { data: lineas } = await supabase
        .from('orden_compra_items')
        .select('orden_id')
        .in('orden_id', candidatas.map((o) => o.id))
        .eq('proveedor_nit_normalizado', nit)
      const delProveedor = new Set(((lineas ?? []) as { orden_id: number }[]).map((l) => l.orden_id))
      for (const orden of candidatas) {
        if (delProveedor.has(orden.id)) ordenPorNumero.set(orden.numero_oc.toLowerCase(), orden.id)
      }
    }

    const vinculadasIds = [...ordenPorNumero.values()]
    const desempenoPorOrden = new Map<number, number>()
    if (vinculadasIds.length > 0) {
      const { data: existentes } = await supabase
        .from('proveedor_desempeno')
        .select('id, orden_id')
        .eq('proveedor_id', proveedorId)
        .in('orden_id', vinculadasIds)
      for (const e of (existentes ?? []) as { id: number; orden_id: number }[]) {
        desempenoPorOrden.set(e.orden_id, e.id)
      }
    }

    for (const fila of lote) {
      const datos = {
        fecha_entrega_prometida: fila.fecha_entrega_prometida,
        fecha_entrega_real: fila.fecha_entrega_real,
        devoluciones: fila.devoluciones,
        observaciones: fila.observaciones,
        factura_remision: fila.factura_remision,
      }
      const clave = fila.numero_oc.toLowerCase()
      const ordenId = ordenPorNumero.get(clave)

      let respuesta
      if (ordenId != null) {
        vinculados++
        const existente = desempenoPorOrden.get(ordenId)
        respuesta = existente
          ? await supabase.from('proveedor_desempeno').update(datos).eq('id', existente)
          : await supabase
              .from('proveedor_desempeno')
              .insert({ ...datos, proveedor_id: proveedorId, orden_id: ordenId })
        if (existente) actualizados++
        else creados++
      } else {
        const existente = historicaPorNumero.get(clave)
        const historica = { ...datos, numero_oc: fila.numero_oc, fecha_oc: fila.fecha_oc }
        respuesta = existente
          ? await supabase.from('proveedor_desempeno').update(historica).eq('id', existente)
          : await supabase
              .from('proveedor_desempeno')
              .insert({ ...historica, proveedor_id: proveedorId, orden_id: null })
        if (existente) actualizados++
        else creados++
      }

      if (respuesta.error) {
        console.error('Failed to import historial row:', respuesta.error)
        return { ok: false, error: `No se pudo guardar la orden ${fila.numero_oc}.` }
      }
    }
  }

  return { ok: true, creados, actualizados, vinculados }
}
