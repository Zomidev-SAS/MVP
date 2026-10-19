'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { leerOcSiigoDesdePdf, MAX_BYTES_PDF } from '@/lib/oc-documento/leer-pdf'
import { ErrorLecturaOc } from '@/lib/oc-documento/parse-siigo-oc'
import { estamparFirma } from '@/lib/oc-documento/firmar-pdf'

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
