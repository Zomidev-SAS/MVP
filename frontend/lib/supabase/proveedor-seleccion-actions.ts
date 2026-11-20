'use server'

import { requireRole } from '@/lib/auth/require-role'
import {
  getDevPreviewHistorial,
  getDevPreviewSelecciones,
} from '@/lib/dev/preview-proveedores-data'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { ROUTE_PERMISSIONS } from '@/lib/permissions/roles'
import { CONFIG_DESEMPENO_DEFAULT, promedio } from '@/lib/proveedores/desempeno'
import { esMigracionPendiente } from '@/lib/proveedores/errores'
import { diferenciaEnDias } from '@/lib/proveedores/fechas'
import { construirFilasHistorial, seCalifica, type FilaHistorial } from '@/lib/proveedores/historial'
import { createClient } from '@/lib/supabase/server'
import { leerConfigDesempeno } from '@/lib/supabase/proveedor-config'
import { cargarHistoriales } from '@/lib/supabase/proveedor-historial'
import { MIGRACION_PENDIENTE } from '@/lib/types/proveedor'
import {
  guardarSeleccionSchema,
  type Candidato,
  type GuardarSeleccionInput,
  type ReferenciaProveedor,
  type Seleccion,
  type SeleccionResultado,
  type SeleccionResumen,
} from '@/lib/types/proveedor-seleccion'

const MENSAJE_MIGRACION = 'Falta aplicar la migración 083 en Supabase para guardar evaluaciones de selección.'

const SELECT_SELECCION =
  'id, titulo, necesidad, estado, proveedor_elegido_id, nombre_elegido, conclusion, creado_por_nombre, created_at, updated_at'

type CandidatoRow = {
  id: number
  proveedor_id: number | null
  nombre_nuevo: string | null
  precio: number | null
  tiempo_entrega_dias: number | null
  calidad: Candidato['calidad']
  observaciones: string | null
  orden: number
  proveedores: { nombre: string } | null
}

function mapCandidato(row: CandidatoRow): Candidato {
  return {
    id: row.id,
    proveedor_id: row.proveedor_id,
    nombre: row.proveedores?.nombre ?? row.nombre_nuevo ?? 'Proveedor sin nombre',
    es_nuevo: row.proveedor_id == null,
    precio: row.precio == null ? null : Number(row.precio),
    tiempo_entrega_dias: row.tiempo_entrega_dias == null ? null : Number(row.tiempo_entrega_dias),
    calidad: row.calidad,
    observaciones: row.observaciones,
    orden: row.orden,
  }
}

export async function fetchSelecciones(): Promise<{ selecciones: SeleccionResumen[]; error?: string }> {
  if (isDevBypassActive()) {
    return {
      selecciones: getDevPreviewSelecciones().map(({ candidatos, ...resto }) => ({
        ...resto,
        total_candidatos: candidatos.length,
      })),
    }
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.proveedores)
  if (!auth.ok) return { selecciones: [], error: auth.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proveedor_selecciones')
    .select(`${SELECT_SELECCION}, proveedor_seleccion_candidatos(count)`)
    .order('updated_at', { ascending: false })

  if (error) {
    if (esMigracionPendiente(error)) return { selecciones: [], error: MIGRACION_PENDIENTE }
    console.error('Failed to load proveedor_selecciones:', error)
    return { selecciones: [], error: 'No se pudieron cargar las evaluaciones.' }
  }

  return {
    selecciones: (
      (data ?? []) as unknown as Array<
        Omit<SeleccionResumen, 'total_candidatos'> & {
          proveedor_seleccion_candidatos: { count: number }[]
        }
      >
    ).map(({ proveedor_seleccion_candidatos, ...resto }) => ({
      ...resto,
      total_candidatos: proveedor_seleccion_candidatos?.[0]?.count ?? 0,
    })),
  }
}

export async function fetchSeleccionById(id: number): Promise<Seleccion | null> {
  if (!Number.isInteger(id) || id <= 0) return null

  if (isDevBypassActive()) {
    return getDevPreviewSelecciones().find((s) => s.id === id) ?? null
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.proveedores)
  if (!auth.ok) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proveedor_selecciones')
    .select(
      `${SELECT_SELECCION}, proveedor_seleccion_candidatos(id, proveedor_id, nombre_nuevo, precio, tiempo_entrega_dias, calidad, observaciones, orden, proveedores(nombre))`
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    if (error && !esMigracionPendiente(error)) console.error('Failed to load seleccion:', error)
    return null
  }

  const { proveedor_seleccion_candidatos, ...resto } = data as unknown as Omit<Seleccion, 'candidatos'> & {
    proveedor_seleccion_candidatos: CandidatoRow[]
  }
  return {
    ...resto,
    candidatos: (proveedor_seleccion_candidatos ?? [])
      .map(mapCandidato)
      .sort((a, b) => a.orden - b.orden),
  }
}

export async function guardarSeleccion(input: GuardarSeleccionInput): Promise<SeleccionResultado> {
  const parsed = guardarSeleccionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.proveedores)
  if (!auth.ok) return { ok: false, error: auth.error }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    return { ok: true, id: parsed.data.id ?? 99 }
  }

  const datos = parsed.data
  const supabase = await createClient()

  const elegido = datos.elegido == null ? null : datos.candidatos[datos.elegido]
  let nombreElegido: string | null = elegido?.nombre_nuevo || null
  if (elegido?.proveedor_id != null) {
    const { data: proveedor } = await supabase
      .from('proveedores')
      .select('nombre')
      .eq('id', elegido.proveedor_id)
      .maybeSingle()
    nombreElegido = (proveedor as { nombre: string } | null)?.nombre ?? nombreElegido
  }

  const cabecera = {
    titulo: datos.titulo,
    necesidad: datos.necesidad || null,
    estado: datos.estado,
    proveedor_elegido_id: elegido?.proveedor_id ?? null,
    nombre_elegido: nombreElegido,
    conclusion: datos.conclusion || null,
  }

  let id = datos.id
  if (id != null) {
    const { error } = await supabase.from('proveedor_selecciones').update(cabecera).eq('id', id)
    if (error) {
      if (esMigracionPendiente(error)) return { ok: false, error: MENSAJE_MIGRACION }
      console.error('Failed to update seleccion:', error)
      return { ok: false, error: 'No se pudo guardar la evaluación.' }
    }
  } else {
    const { data, error } = await supabase
      .from('proveedor_selecciones')
      .insert(cabecera)
      .select('id')
      .single()
    if (error || !data) {
      if (esMigracionPendiente(error)) return { ok: false, error: MENSAJE_MIGRACION }
      console.error('Failed to create seleccion:', error)
      return { ok: false, error: 'No se pudo crear la evaluación.' }
    }
    id = (data as { id: number }).id
  }

  // Los candidatos se reemplazan completos: es una lista corta que se edita como un todo.
  const { error: errorBorrado } = await supabase
    .from('proveedor_seleccion_candidatos')
    .delete()
    .eq('seleccion_id', id)
  if (errorBorrado) {
    console.error('Failed to replace candidatos:', errorBorrado)
    return { ok: false, error: 'No se pudieron guardar los proveedores comparados.' }
  }

  const { error: errorCandidatos } = await supabase.from('proveedor_seleccion_candidatos').insert(
    datos.candidatos.map((c, i) => ({
      seleccion_id: id,
      proveedor_id: c.proveedor_id,
      nombre_nuevo: c.proveedor_id == null ? c.nombre_nuevo : null,
      precio: c.precio,
      tiempo_entrega_dias: c.tiempo_entrega_dias,
      calidad: c.calidad,
      observaciones: c.observaciones || null,
      orden: i + 1,
    }))
  )
  if (errorCandidatos) {
    console.error('Failed to insert candidatos:', errorCandidatos)
    return { ok: false, error: 'No se pudieron guardar los proveedores comparados.' }
  }

  return { ok: true, id }
}

export async function eliminarSeleccion(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Evaluación inválida.' }

  const auth = await requireRole(['supervisor'])
  if (!auth.ok) return { ok: false, error: 'Solo el supervisor puede eliminar evaluaciones.' }

  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    return { ok: true }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('proveedor_selecciones').delete().eq('id', id)
  if (error) {
    if (esMigracionPendiente(error)) return { ok: false, error: MENSAJE_MIGRACION }
    console.error('Failed to delete seleccion:', error)
    return { ok: false, error: 'No se pudo eliminar la evaluación.' }
  }
  return { ok: true }
}

function referenciaDeFilas(filas: FilaHistorial[]): ReferenciaProveedor {
  const calificadas = filas.filter((f) => seCalifica(f.estado))
  return {
    tiempo_promedio_dias: promedio(
      calificadas.map((f) => diferenciaEnDias(f.fecha_oc, f.fecha_entrega_real))
    ),
    calidad_indice: promedio(calificadas.map((f) => f.puntajes?.calidad ?? null)),
  }
}

/** Tiempo de entrega y calidad históricos de un proveedor, para precargar el cuadro comparativo. */
export async function fetchReferenciaProveedor(proveedorId: number): Promise<ReferenciaProveedor> {
  const vacia: ReferenciaProveedor = { tiempo_promedio_dias: null, calidad_indice: null }
  if (!Number.isInteger(proveedorId) || proveedorId <= 0) return vacia

  if (isDevBypassActive()) {
    const { ordenes, registros } = getDevPreviewHistorial()
    return referenciaDeFilas(construirFilasHistorial(ordenes, registros, CONFIG_DESEMPENO_DEFAULT))
  }

  const auth = await requireRole(ROUTE_PERMISSIONS.proveedores)
  if (!auth.ok) return vacia

  const supabase = await createClient()
  const { data: proveedor } = await supabase
    .from('proveedores')
    .select('id, nit_normalizado')
    .eq('id', proveedorId)
    .maybeSingle()
  if (!proveedor) return vacia

  try {
    const config = await leerConfigDesempeno(supabase)
    const historiales = await cargarHistoriales(
      supabase,
      [proveedor as { id: number; nit_normalizado: string }],
      config
    )
    return referenciaDeFilas(historiales.get(proveedorId) ?? [])
  } catch (fallo) {
    console.error('Failed to load referencia proveedor:', fallo)
    return vacia
  }
}
