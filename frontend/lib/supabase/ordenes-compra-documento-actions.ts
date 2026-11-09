'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { leerOcSiigoDesdePdf, MAX_BYTES_PDF } from '@/lib/oc-documento/leer-pdf'
import { ErrorLecturaOc } from '@/lib/oc-documento/parse-siigo-oc'
import { estamparFirma } from '@/lib/oc-documento/firmar-pdf'
import { nombreProveedorIncompleto } from '@/lib/oc-documento/nombre-proveedor'

const BUCKET_DOCUMENTOS = 'ordenes-compra'
const BUCKET_FIRMAS = 'firmas-admin'
const CODIGO_SIN_CATALOGO = 'SIN-CODIGO'

export type SubirOcResultado =
  | { ok: true; id: number; numero: string; sinCodigo: string[] }
  | { ok: false; error: string }

export type SimpleResultado = { ok: true } | { ok: false; error: string }

function esPdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && String.fromCharCode(...bytes.slice(0, 4)) === '%PDF'
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

/**
 * Sube la orden de compra que genera Siigo, lee sus datos y crea la OC en el
 * panel (solo visualización: no se envía nada a Siigo, ya existe allá).
 */
export async function subirOrdenCompraDocumento(formData: FormData): Promise<SubirOcResultado> {
  const auth = await requireRole(['supervisor', 'compras'])
  if (!auth.ok) return { ok: false, error: auth.error }
  if (isDevBypassActive()) {
    return { ok: false, error: 'La subida de documentos no está disponible en modo demostración.' }
  }

  const archivo = formData.get('archivo')
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: 'Selecciona el PDF de la orden de compra.' }
  }
  if (archivo.size > MAX_BYTES_PDF) {
    return { ok: false, error: 'El PDF supera los 5 MB.' }
  }
  const bytes = new Uint8Array(await archivo.arrayBuffer())
  if (!esPdf(bytes)) {
    return { ok: false, error: 'El archivo no es un PDF válido.' }
  }

  let oc
  try {
    oc = await leerOcSiigoDesdePdf(bytes)
  } catch (error) {
    if (error instanceof ErrorLecturaOc) return { ok: false, error: error.message }
    console.error('Failed to read OC pdf:', error)
    return { ok: false, error: 'No se pudo leer el documento.' }
  }

  const supabase = await createClient()

  const { data: existente } = await supabase
    .from('ordenes_compra')
    .select('id')
    .eq('numero_oc', oc.numero_oc)
    .maybeSingle()
  if (existente) {
    return { ok: false, error: `La orden ${oc.numero_oc} ya está cargada en Compras.` }
  }

  // Siigo no trae el código en la OC: se busca en el catálogo por nombre.
  const nombres = [...new Set(oc.lineas.flatMap((l) => [l.descripcion, normalizar(l.descripcion)]))]
  const { data: catalogo } = await supabase
    .from('productos')
    .select('codigo_producto, nombre_producto')
    .in('nombre_producto', nombres)
  const porNombre = new Map<string, string>()
  for (const p of catalogo ?? []) porNombre.set(normalizar(p.nombre_producto), p.codigo_producto)

  const sinCodigo: string[] = []
  const lineas = oc.lineas.map((l, idx) => {
    const codigo = porNombre.get(normalizar(l.descripcion))
    if (!codigo) sinCodigo.push(l.descripcion)
    return {
      codigo_producto: codigo ?? CODIGO_SIN_CATALOGO,
      nombre_producto: l.descripcion,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      orden_linea: idx + 1,
    }
  })

  const ruta = `originales/${oc.numero_oc}-${Date.now()}.pdf`
  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .upload(ruta, bytes, { contentType: 'application/pdf', upsert: false })
  if (errorSubida) {
    console.error('Failed to upload OC pdf:', errorSubida)
    return { ok: false, error: 'No se pudo guardar el documento.' }
  }

  const primero = lineas[0]
  const { data: insertada, error: errorOrden } = await supabase
    .from('ordenes_compra')
    .insert({
      numero_oc: oc.numero_oc,
      origen: 'documento_siigo',
      estado: 'en_curso',
      fecha_pedido: oc.fecha ?? new Date().toISOString().slice(0, 10),
      observaciones: oc.observaciones,
      total_pagar: oc.total_pagar,
      documento_path: ruta,
      // La OC ya existe en Siigo: se muestra como sincronizada con su número.
      siigo_estado: 'sincronizada',
      siigo_referencia: oc.numero_oc,
      creado_por: auth.user.id,
      codigo_producto: primero.codigo_producto,
      nombre_producto: primero.nombre_producto,
      cantidad: primero.cantidad,
      descripcion: primero.descripcion,
      proveedor_nit: oc.proveedor_nit,
      proveedor_nombre: oc.proveedor_nombre,
    })
    .select('id')
    .single()

  if (errorOrden || !insertada) {
    console.error('Failed to insert OC from document:', errorOrden)
    await supabase.storage.from(BUCKET_DOCUMENTOS).remove([ruta])
    return { ok: false, error: 'No se pudo crear la orden de compra.' }
  }

  const { error: errorItems } = await supabase.from('orden_compra_items').insert(
    lineas.map((l) => ({
      ...l,
      orden_id: insertada.id,
      proveedor_nit: oc.proveedor_nit,
      proveedor_nombre: oc.proveedor_nombre,
    }))
  )
  if (errorItems) {
    console.error('Failed to insert OC items from document:', errorItems)
    await supabase.from('ordenes_compra').delete().eq('id', insertada.id)
    await supabase.storage.from(BUCKET_DOCUMENTOS).remove([ruta])
    return { ok: false, error: 'No se pudieron guardar las líneas de la orden.' }
  }

  return { ok: true, id: insertada.id, numero: oc.numero_oc, sinCodigo }
}

/**
 * Firma la OC con la firma precargada del administrador: estampa la imagen en
 * el PDF original, guarda el firmado y avisa por panel y correo.
 */
export async function firmarOrdenCompraDocumento(ordenId: number): Promise<SimpleResultado> {
  const auth = await requireRole(['supervisor'])
  if (!auth.ok) return { ok: false, error: auth.error }
  if (isDevBypassActive()) {
    return { ok: false, error: 'La firma no está disponible en modo demostración.' }
  }

  const supabase = await createClient()

  const { data: perfil } = await supabase
    .from('profiles')
    .select('firma_path, firma_nombre, nombre')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (!perfil?.firma_path) {
    return { ok: false, error: 'Tu usuario no tiene una firma precargada. Pide que la carguen.' }
  }

  const { data: orden } = await supabase
    .from('ordenes_compra')
    .select('id, documento_path, firmada_at')
    .eq('id', ordenId)
    .maybeSingle()
  if (!orden?.documento_path) return { ok: false, error: 'La orden no tiene documento para firmar.' }
  if (orden.firmada_at) return { ok: false, error: 'La orden ya está firmada.' }

  const [original, firma] = await Promise.all([
    supabase.storage.from(BUCKET_DOCUMENTOS).download(orden.documento_path),
    supabase.storage.from(BUCKET_FIRMAS).download(perfil.firma_path),
  ])
  if (original.error || !original.data) return { ok: false, error: 'No se pudo abrir el documento original.' }
  if (firma.error || !firma.data) return { ok: false, error: 'No se pudo abrir tu firma precargada.' }

  const bytesOriginal = new Uint8Array(await original.data.arrayBuffer())
  const bytesFirma = new Uint8Array(await firma.data.arrayBuffer())

  // El diseño sirve para ubicar la firma; si no se puede leer, va en una hoja aparte.
  const diseño = await leerOcSiigoDesdePdf(bytesOriginal)
    .then((oc) => oc.diseño)
    .catch(() => null)

  let firmado: Uint8Array
  try {
    firmado = await estamparFirma({
      pdf: bytesOriginal,
      firmaPng: bytesFirma,
      nombre: perfil.firma_nombre?.trim() || perfil.nombre?.trim() || 'el administrador',
      fecha: new Date(),
      diseño,
    })
  } catch (error) {
    console.error('Failed to stamp signature:', error)
    return { ok: false, error: 'No se pudo estampar la firma en el documento.' }
  }

  const rutaFirmado = `firmados/${ordenId}-${Date.now()}.pdf`
  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .upload(rutaFirmado, firmado, { contentType: 'application/pdf', upsert: false })
  if (errorSubida) {
    console.error('Failed to upload signed pdf:', errorSubida)
    return { ok: false, error: 'No se pudo guardar el documento firmado.' }
  }

  const { error: errorRpc } = await supabase.rpc('rpc_firmar_oc', {
    p_orden_id: ordenId,
    p_path_firmado: rutaFirmado,
    p_pdf_base64: Buffer.from(firmado).toString('base64'),
    p_nombre_firma: perfil.firma_nombre?.trim() || perfil.nombre?.trim() || '',
  })
  if (errorRpc) {
    console.error('rpc_firmar_oc failed:', errorRpc)
    await supabase.storage.from(BUCKET_DOCUMENTOS).remove([rutaFirmado])
    return { ok: false, error: `No se pudo registrar la firma: ${errorRpc.message}` }
  }

  return { ok: true }
}

/** URL temporal (2 minutos) para ver el documento original o el firmado. */
export async function urlDocumentoOrdenCompra(
  ordenId: number,
  version: 'original' | 'firmado'
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const auth = await requireRole(['supervisor', 'compras', 'auditoria', 'produccion', 'metalmecanica', 'instalacion'])
  if (!auth.ok) return { ok: false, error: auth.error }
  if (isDevBypassActive()) return { ok: false, error: 'No disponible en modo demostración.' }

  const supabase = await createClient()
  const { data: orden } = await supabase
    .from('ordenes_compra')
    .select('documento_path, documento_firmado_path')
    .eq('id', ordenId)
    .maybeSingle()

  const ruta = version === 'firmado' ? orden?.documento_firmado_path : orden?.documento_path
  if (!ruta) return { ok: false, error: 'La orden no tiene ese documento.' }

  const { data, error } = await supabase.storage.from(BUCKET_DOCUMENTOS).createSignedUrl(ruta, 120)
  if (error || !data) return { ok: false, error: 'No se pudo abrir el documento.' }
  return { ok: true, url: data.signedUrl }
}

export type CorreccionProveedoresResultado =
  | { ok: true; corregidas: { numero: string; antes: string; despues: string }[]; revisadas: number }
  | { ok: false; error: string }

/**
 * Vuelve a leer el PDF original de las OC cargadas desde Siigo y completa el
 * nombre del proveedor cuando se había guardado cortado ("LTDA", "S.A.S.").
 * Solo cambia un nombre si el leído ahora lo contiene entero (nunca reemplaza
 * un nombre por otro distinto).
 */
export async function corregirProveedoresOrdenesDocumento(): Promise<CorreccionProveedoresResultado> {
  const auth = await requireRole(['supervisor', 'compras'])
  if (!auth.ok) return { ok: false, error: auth.error }
  if (isDevBypassActive()) return { ok: false, error: 'No disponible en modo demostración.' }

  const supabase = await createClient()
  const { data: ordenes, error } = await supabase
    .from('ordenes_compra')
    .select('id, numero_oc, proveedor_nombre, documento_path')
    .eq('origen', 'documento_siigo')
    .not('documento_path', 'is', null)
  if (error) {
    console.error('Failed to list OC for provider fix:', error)
    return { ok: false, error: 'No se pudieron consultar las órdenes.' }
  }

  const corregidas: { numero: string; antes: string; despues: string }[] = []
  let revisadas = 0
  for (const orden of ordenes ?? []) {
    const guardado = (orden.proveedor_nombre ?? '').trim()
    // Solo se tocan los nombres que quedaron cortados ("LTDA", "S.A.S.").
    if (!nombreProveedorIncompleto(guardado)) continue
    revisadas++

    const original = await supabase.storage.from(BUCKET_DOCUMENTOS).download(orden.documento_path as string)
    if (original.error || !original.data) continue

    let leida
    try {
      leida = await leerOcSiigoDesdePdf(new Uint8Array(await original.data.arrayBuffer()))
    } catch {
      continue
    }

    const nuevo = leida.proveedor_nombre.trim()
    if (!nuevo || nuevo.length <= guardado.length || !normalizar(nuevo).includes(normalizar(guardado))) continue

    const { error: errorOrden } = await supabase
      .from('ordenes_compra')
      .update({ proveedor_nombre: nuevo })
      .eq('id', orden.id)
    if (errorOrden) {
      console.error('Failed to fix provider name:', errorOrden)
      continue
    }
    await supabase.from('orden_compra_items').update({ proveedor_nombre: nuevo }).eq('orden_id', orden.id)
    corregidas.push({ numero: orden.numero_oc ?? String(orden.id), antes: guardado, despues: nuevo })
  }

  return { ok: true, corregidas, revisadas }
}


export type RelecturaResultado =
  | { ok: true; agregadas: number; total: number }
  | { ok: false; error: string }

/**
 * Vuelve a leer el PDF original de una OC cargada desde Siigo y agrega las líneas que
 * el panel no tenía (por ejemplo, si se cargó con una versión anterior del lector que
 * se saltaba filas). No borra ni cambia las líneas existentes ni sus recepciones.
 */
export async function releerLineasDocumento(ordenId: number): Promise<RelecturaResultado> {
  const auth = await requireRole(['supervisor', 'compras'])
  if (!auth.ok) return { ok: false, error: auth.error }
  if (isDevBypassActive()) {
    return { ok: false, error: 'No está disponible en modo demostración.' }
  }

  const supabase = await createClient()
  const { data: orden } = await supabase
    .from('ordenes_compra')
    .select('id, origen, documento_path, proveedor_nit, proveedor_nombre')
    .eq('id', ordenId)
    .maybeSingle()
  if (!orden || orden.origen !== 'documento_siigo' || !orden.documento_path) {
    return { ok: false, error: 'Esta orden no se cargó desde un documento de Siigo.' }
  }

  const { data: archivo, error: errorBajada } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .download(orden.documento_path)
  if (errorBajada || !archivo) {
    console.error('Failed to download OC pdf:', errorBajada)
    return { ok: false, error: 'No se pudo abrir el documento original.' }
  }

  let oc
  try {
    oc = await leerOcSiigoDesdePdf(new Uint8Array(await archivo.arrayBuffer()))
  } catch (error) {
    if (error instanceof ErrorLecturaOc) return { ok: false, error: error.message }
    console.error('Failed to re-read OC pdf:', error)
    return { ok: false, error: 'No se pudo leer el documento.' }
  }

  const { data: existentes } = await supabase
    .from('orden_compra_items')
    .select('id, descripcion, nombre_producto, orden_linea')
    .eq('orden_id', ordenId)
  const sinEmparejar = [...(existentes ?? [])]
  const faltantes = oc.lineas.filter((l) => {
    const clave = normalizar(l.descripcion)
    const idx = sinEmparejar.findIndex((e) => normalizar(e.descripcion ?? e.nombre_producto ?? '') === clave)
    if (idx >= 0) {
      sinEmparejar.splice(idx, 1)
      return false
    }
    return true
  })

  if (faltantes.length === 0) {
    return { ok: true, agregadas: 0, total: oc.lineas.length }
  }

  const nombres = [...new Set(faltantes.flatMap((l) => [l.descripcion, normalizar(l.descripcion)]))]
  const { data: catalogo } = await supabase
    .from('productos')
    .select('codigo_producto, nombre_producto')
    .in('nombre_producto', nombres)
  const porNombre = new Map<string, string>()
  for (const p of catalogo ?? []) porNombre.set(normalizar(p.nombre_producto), p.codigo_producto)

  const ultima = Math.max(0, ...(existentes ?? []).map((e) => Number(e.orden_linea ?? 0)))
  const filas = faltantes.map((l, i) => ({
    orden_id: ordenId,
    codigo_producto: porNombre.get(normalizar(l.descripcion)) ?? CODIGO_SIN_CATALOGO,
    nombre_producto: l.descripcion,
    descripcion: l.descripcion,
    cantidad: l.cantidad,
    precio_unitario: l.precio_unitario,
    orden_linea: ultima + i + 1,
    proveedor_nit: orden.proveedor_nit,
    proveedor_nombre: orden.proveedor_nombre,
  }))

  const { error: errorInsert } = await supabase.from('orden_compra_items').insert(filas)
  if (errorInsert) {
    console.error('Failed to insert missing OC lines:', errorInsert)
    return { ok: false, error: 'No se pudieron agregar las líneas que faltaban.' }
  }

  await supabase.from('ordenes_compra').update({ updated_at: new Date().toISOString() }).eq('id', ordenId)
  const { error: errorAuditoria } = await supabase.from('ordenes_compra_auditoria').insert({
    orden_id: ordenId,
    accion: 'releer_documento',
    motivo: 'Se volvió a leer el PDF original',
    detalle: { cambios: faltantes.map((l) => `Agregado ${l.descripcion}: ${l.cantidad}`) },
    usuario_id: auth.user.id,
  })
  if (errorAuditoria) console.error('Failed to register OC audit entry:', errorAuditoria)

  return { ok: true, agregadas: faltantes.length, total: oc.lineas.length }
}
