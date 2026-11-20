'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewHistorial, getDevPreviewProveedores } from '@/lib/dev/preview-proveedores-data'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { esMigracionPendiente } from '@/lib/proveedores/errores'
import { CONFIG_DESEMPENO_DEFAULT, promedio, type ConfigDesempeno } from '@/lib/proveedores/desempeno'
import { construirFilasHistorial, type FilaHistorial } from '@/lib/proveedores/historial'
import { normalizarNit } from '@/lib/proveedores/nit'
import { leerConfigDesempeno } from '@/lib/supabase/proveedor-config'
import { cargarHistoriales, ErrorHistorial } from '@/lib/supabase/proveedor-historial'
import {
  MIGRACION_PENDIENTE,
  guardarProveedorSchema,
  type GuardarProveedorInput,
  type ImportarProveedoresResultado,
  type Proveedor,
  type ProveedorFila,
  type ProveedorResultado,
  type ProveedoresListado,
} from '@/lib/types/proveedor'

const COLUMNAS_PROVEEDOR =
  'id, nit, nit_normalizado, nombre, email, telefono, contacto, notas, activo, origen, created_at, updated_at'

const MENSAJE_MIGRACION = 'Falta aplicar la migración 080 en Supabase.'
const TAMANO_LOTE = 200
const MAX_FILAS_IMPORTACION = 2000

function vacioANull(valor: string): string | null {
  const limpio = valor.trim()
  return limpio === '' ? null : limpio
}

export async function fetchProveedores(): Promise<ProveedoresListado> {
  if (isDevBypassActive()) {
    return { filas: getDevPreviewProveedores() }
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.proveedores)
  if (!auth.ok) return { filas: [], error: auth.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proveedores')
    .select(COLUMNAS_PROVEEDOR)
    .order('nombre', { ascending: true })

  if (error) {
    if (esMigracionPendiente(error)) return { filas: [], error: MIGRACION_PENDIENTE }
    console.error('Failed to load proveedores:', error)
    return { filas: [], error: 'No se pudieron cargar los proveedores.' }
  }

  const proveedores = (data ?? []) as Proveedor[]
  const config = await leerConfigDesempeno(supabase)

  let historiales = new Map<number, FilaHistorial[]>()
  try {
    historiales = await cargarHistoriales(supabase, proveedores, config)
  } catch (fallo) {
    // La lista se muestra igual; solo faltarán los conteos y porcentajes.
    console.error('Failed to load historiales for proveedores list:', fallo)
  }

  const filas: ProveedorFila[] = proveedores.map((p) => {
    const historial = historiales.get(p.id) ?? []
    const globales = historial.map((f) => f.puntajes?.global ?? null)
    return {
      ...p,
      total_ordenes: historial.length,
      ordenes_puntuadas: globales.filter((g) => g != null).length,
      porcentaje_promedio: promedio(globales),
      // La reevaluación anual llega en la fase 3.
      ultima_reevaluacion: null,
    }
  })

  return { filas }
}

export async function fetchProveedorById(id: number): Promise<Proveedor | null> {
  if (!Number.isInteger(id) || id <= 0) return null

  if (isDevBypassActive()) {
    return getDevPreviewProveedores().find((p) => p.id === id) ?? null
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.proveedores)
  if (!auth.ok) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proveedores')
    .select(COLUMNAS_PROVEEDOR)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    if (!esMigracionPendiente(error)) console.error('Failed to load proveedor:', error)
    return null
  }

  return (data as Proveedor | null) ?? null
}

export async function crearProveedor(input: GuardarProveedorInput): Promise<ProveedorResultado> {
  const parsed = guardarProveedorSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos. Revisa el formulario.' }
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.proveedores)
  if (!auth.ok) return { ok: false, error: auth.error }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return { ok: true }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proveedores')
    .insert({
      nit: parsed.data.nit,
      nombre: parsed.data.nombre,
      email: vacioANull(parsed.data.email),
      telefono: vacioANull(parsed.data.telefono),
      contacto: vacioANull(parsed.data.contacto),
      notas: vacioANull(parsed.data.notas),
      origen: 'manual',
    })
    .select('id')
    .single()

  if (error || !data) {
    if (esMigracionPendiente(error)) return { ok: false, error: MENSAJE_MIGRACION }
    if (error?.code === '23505') {
      return { ok: false, error: 'Ya existe un proveedor con ese NIT.' }
    }
    console.error('Failed to create proveedor:', error)
    return { ok: false, error: 'No se pudo crear el proveedor.' }
  }

  return { ok: true, id: (data as { id: number }).id }
}

export async function actualizarProveedor(
  id: number,
  input: GuardarProveedorInput
): Promise<ProveedorResultado> {
  const parsed = guardarProveedorSchema.safeParse(input)
  if (!parsed.success || !Number.isInteger(id) || id <= 0) {
    return { ok: false, error: 'Datos inválidos. Revisa el formulario.' }
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.proveedores)
  if (!auth.ok) return { ok: false, error: auth.error }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return { ok: true, id }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proveedores')
    .update({
      nit: parsed.data.nit,
      nombre: parsed.data.nombre,
      email: vacioANull(parsed.data.email),
      telefono: vacioANull(parsed.data.telefono),
      contacto: vacioANull(parsed.data.contacto),
      notas: vacioANull(parsed.data.notas),
    })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    if (esMigracionPendiente(error)) return { ok: false, error: MENSAJE_MIGRACION }
    if (error.code === '23505') {
      return { ok: false, error: 'Ya existe otro proveedor con ese NIT.' }
    }
    console.error('Failed to update proveedor:', error)
    return { ok: false, error: 'No se pudo guardar el proveedor.' }
  }
  if (!data) return { ok: false, error: 'No se encontró el proveedor.' }

  return { ok: true, id }
}

export async function eliminarProveedor(id: number): Promise<ProveedorResultado> {
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: 'Proveedor inválido.' }
  }

  const auth = await requireRole(['supervisor'])
  if (!auth.ok) return { ok: false, error: 'Solo el supervisor puede eliminar proveedores.' }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return { ok: true }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('proveedores').delete().eq('id', id)

  if (error) {
    if (esMigracionPendiente(error)) return { ok: false, error: MENSAJE_MIGRACION }
    console.error('Failed to delete proveedor:', error)
    return { ok: false, error: 'No se pudo eliminar el proveedor.' }
  }

  return { ok: true }
}

export async function importarProveedores(
  filas: GuardarProveedorInput[]
): Promise<ImportarProveedoresResultado> {
  if (!Array.isArray(filas) || filas.length === 0) {
    return { ok: false, error: 'No hay proveedores para importar.' }
  }
  if (filas.length > MAX_FILAS_IMPORTACION) {
    return { ok: false, error: `Máximo ${MAX_FILAS_IMPORTACION} proveedores por importación.` }
  }

  const validadas: GuardarProveedorInput[] = []
  const vistos = new Set<string>()
  for (const fila of filas) {
    const parsed = guardarProveedorSchema.safeParse(fila)
    if (!parsed.success) {
      return { ok: false, error: 'El archivo tiene filas inválidas. Vuelve a leerlo.' }
    }
    const clave = normalizarNit(parsed.data.nit)
    if (vistos.has(clave)) continue
    vistos.add(clave)
    validadas.push(parsed.data)
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.proveedores)
  if (!auth.ok) return { ok: false, error: auth.error }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { ok: true, creados: validadas.length, actualizados: 0 }
  }

  const supabase = await createClient()
  let creados = 0
  let actualizados = 0

  for (let i = 0; i < validadas.length; i += TAMANO_LOTE) {
    const lote = validadas.slice(i, i + TAMANO_LOTE)
    const nits = lote.map((f) => normalizarNit(f.nit))

    const { data: existentes, error: errorExistentes } = await supabase
      .from('proveedores')
      .select('id, nit_normalizado')
      .in('nit_normalizado', nits)

    if (errorExistentes) {
      if (esMigracionPendiente(errorExistentes)) return { ok: false, error: MENSAJE_MIGRACION }
      console.error('Failed to look up proveedores before import:', errorExistentes)
      return { ok: false, error: 'No se pudo importar. Intenta de nuevo.' }
    }

    const idPorNit = new Map(
      ((existentes ?? []) as { id: number; nit_normalizado: string }[]).map((e) => [
        e.nit_normalizado,
        e.id,
      ])
    )

    const nuevos = lote.filter((f) => !idPorNit.has(normalizarNit(f.nit)))
    const aActualizar = lote.filter((f) => idPorNit.has(normalizarNit(f.nit)))

    if (nuevos.length > 0) {
      const { error } = await supabase.from('proveedores').insert(
        nuevos.map((f) => ({
          nit: f.nit,
          nombre: f.nombre,
          email: vacioANull(f.email),
          telefono: vacioANull(f.telefono),
          contacto: vacioANull(f.contacto),
          notas: vacioANull(f.notas),
          origen: 'importado',
        }))
      )
      if (error) {
        console.error('Failed to insert proveedores:', error)
        return { ok: false, error: 'No se pudieron crear algunos proveedores.' }
      }
      creados += nuevos.length
    }

    // Los que ya existen se actualizan sin pisar con vacío lo que ya tenían.
    const resultados = await Promise.all(
      aActualizar.map((f) => {
        const cambios: Record<string, string> = { nombre: f.nombre }
        if (f.email.trim()) cambios.email = f.email.trim()
        if (f.telefono.trim()) cambios.telefono = f.telefono.trim()
        if (f.contacto.trim()) cambios.contacto = f.contacto.trim()
        if (f.notas.trim()) cambios.notas = f.notas.trim()
        return supabase
          .from('proveedores')
          .update(cambios)
          .eq('id', idPorNit.get(normalizarNit(f.nit))!)
      })
    )
    if (resultados.some((r) => r.error)) {
      console.error('Failed to update some proveedores:', resultados.find((r) => r.error)?.error)
      return { ok: false, error: 'No se pudieron actualizar algunos proveedores.' }
    }
    actualizados += aActualizar.length
  }

  return { ok: true, creados, actualizados }
}

// ---------------------------------------------------------------------------
// Historial de órdenes de un proveedor (con su desempeño)
// ---------------------------------------------------------------------------

export async function fetchHistorialProveedor(
  proveedorId: number
): Promise<{ filas: FilaHistorial[]; config: ConfigDesempeno; error?: string }> {
  if (!Number.isInteger(proveedorId) || proveedorId <= 0) {
    return { filas: [], config: CONFIG_DESEMPENO_DEFAULT }
  }

  if (isDevBypassActive()) {
    const { ordenes, registros } = getDevPreviewHistorial()
    return {
      filas: construirFilasHistorial(ordenes, registros, CONFIG_DESEMPENO_DEFAULT),
      config: CONFIG_DESEMPENO_DEFAULT,
    }
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.proveedores)
  if (!auth.ok) return { filas: [], config: CONFIG_DESEMPENO_DEFAULT, error: auth.error }

  const supabase = await createClient()
  const config = await leerConfigDesempeno(supabase)

  const { data: proveedor, error } = await supabase
    .from('proveedores')
    .select('id, nit_normalizado')
    .eq('id', proveedorId)
    .maybeSingle()

  if (error) {
    if (esMigracionPendiente(error)) return { filas: [], config, error: MIGRACION_PENDIENTE }
    console.error('Failed to load proveedor for historial:', error)
    return { filas: [], config, error: 'No se pudo cargar el historial.' }
  }
  if (!proveedor) return { filas: [], config }

  try {
    const historiales = await cargarHistoriales(
      supabase,
      [proveedor as { id: number; nit_normalizado: string }],
      config
    )
    return { filas: historiales.get(proveedorId) ?? [], config }
  } catch (fallo) {
    if (fallo instanceof ErrorHistorial && fallo.migracionPendiente) {
      return { filas: [], config, error: MIGRACION_PENDIENTE }
    }
    console.error('Failed to load historial:', fallo)
    return { filas: [], config, error: 'No se pudo cargar el historial.' }
  }
}

/** Id del proveedor por NIT (para enlazar desde una orden de compra). */
export async function fetchProveedorIdPorNit(nit: string): Promise<number | null> {
  const nitNormalizado = normalizarNit(nit)
  if (!nitNormalizado) return null

  if (isDevBypassActive()) {
    return getDevPreviewProveedores().find((p) => p.nit_normalizado === nitNormalizado)?.id ?? null
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.proveedores)
  if (!auth.ok) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proveedores')
    .select('id')
    .eq('nit_normalizado', nitNormalizado)
    .maybeSingle()

  if (error) {
    if (!esMigracionPendiente(error)) console.error('Failed to find proveedor by NIT:', error)
    return null
  }
  return (data as { id: number } | null)?.id ?? null
}
