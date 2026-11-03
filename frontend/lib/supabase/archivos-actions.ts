'use server'

import { requireRole } from '@/lib/auth/require-role'
import { crearUrlFirmada, getContenedor } from '@/lib/archivos/azure'
import {
  ROLES_CON_ARCHIVOS,
  carpetasVisibles,
  esCarpeta,
  puedeBorrar,
  puedeSubir,
  puedeVer,
  type Carpeta,
} from '@/lib/archivos/matriz'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { demoAgregar, demoBorrar, demoExiste, demoListar } from '@/lib/dev/preview-archivos-data'
import type { ArchivoItem, CarpetaItem } from '@/lib/types/archivos'

type Resultado<T> = ({ ok: true } & T) | { ok: false; error: string }

const MAX_BYTES = 500 * 1024 * 1024
const MAX_NOMBRE = 150

/** Quita rutas y caracteres de control; los archivos viven planos dentro del contenedor. */
function limpiarNombre(original: string): string | null {
  const base = original.split(/[\\/]/).pop() ?? ''
  const limpio = base.replace(/[\u0000-\u001f]/g, '').trim()
  if (!limpio || limpio === '.' || limpio === '..' || limpio.length > MAX_NOMBRE) return null
  return limpio
}

export async function listarCarpetas(): Promise<Resultado<{ carpetas: CarpetaItem[] }>> {
  const auth = await requireRole(ROLES_CON_ARCHIVOS)
  if (!auth.ok) return auth
  const rol = auth.profile.rol

  return {
    ok: true,
    carpetas: carpetasVisibles(rol).map((nombre) => ({
      nombre,
      puedeSubir: puedeSubir(rol, nombre),
      puedeBorrar: puedeBorrar(rol, nombre),
    })),
  }
}

export async function listarArchivos(carpeta: string): Promise<Resultado<{ archivos: ArchivoItem[] }>> {
  const auth = await requireRole(ROLES_CON_ARCHIVOS)
  if (!auth.ok) return auth
  if (!esCarpeta(carpeta) || !puedeVer(auth.profile.rol, carpeta)) {
    return { ok: false, error: 'No autorizado para esta carpeta.' }
  }

  if (isDevBypassActive()) return { ok: true, archivos: demoListar(carpeta) }

  try {
    const contenedor = getContenedor(carpeta)
    await contenedor.createIfNotExists()
    const archivos: ArchivoItem[] = []
    for await (const blob of contenedor.listBlobsFlat()) {
      archivos.push({
        nombre: blob.name,
        tamano: blob.properties.contentLength ?? 0,
        modificado: blob.properties.lastModified?.toISOString() ?? null,
      })
    }
    archivos.sort((a, b) => (b.modificado ?? '').localeCompare(a.modificado ?? ''))
    return { ok: true, archivos }
  } catch (error) {
    console.error('Failed to list blobs:', error)
    return { ok: false, error: 'No se pudo leer la carpeta.' }
  }
}

export async function crearUrlSubida(
  carpeta: string,
  nombre: string,
  tamano: number
): Promise<Resultado<{ url: string; nombre: string }>> {
  const auth = await requireRole(ROLES_CON_ARCHIVOS)
  if (!auth.ok) return auth
  if (!esCarpeta(carpeta) || !puedeSubir(auth.profile.rol, carpeta)) {
    return { ok: false, error: 'No autorizado para subir a esta carpeta.' }
  }

  const limpio = limpiarNombre(nombre)
  if (!limpio) return { ok: false, error: 'Nombre de archivo no válido.' }
  if (!Number.isFinite(tamano) || tamano <= 0 || tamano > MAX_BYTES) {
    return { ok: false, error: 'El archivo debe pesar entre 1 byte y 500 MB.' }
  }

  if (isDevBypassActive()) {
    if (demoExiste(carpeta, limpio)) return { ok: false, error: `Ya existe "${limpio}" en esta carpeta.` }
    demoAgregar(carpeta, limpio, tamano)
    return { ok: true, url: '', nombre: limpio }
  }

  try {
    const contenedor = getContenedor(carpeta)
    await contenedor.createIfNotExists()
    if (await contenedor.getBlobClient(limpio).exists()) {
      return { ok: false, error: `Ya existe "${limpio}" en esta carpeta.` }
    }
    return { ok: true, url: crearUrlFirmada(carpeta, limpio, 'escritura'), nombre: limpio }
  } catch (error) {
    console.error('Failed to create upload url:', error)
    return { ok: false, error: 'No se pudo preparar la subida.' }
  }
}

export async function crearUrlDescarga(
  carpeta: string,
  nombre: string
): Promise<Resultado<{ url: string }>> {
  const auth = await requireRole(ROLES_CON_ARCHIVOS)
  if (!auth.ok) return auth
  if (!esCarpeta(carpeta) || !puedeVer(auth.profile.rol, carpeta)) {
    return { ok: false, error: 'No autorizado para esta carpeta.' }
  }

  const limpio = limpiarNombre(nombre)
  if (!limpio || limpio !== nombre) return { ok: false, error: 'Nombre de archivo no válido.' }

  if (isDevBypassActive()) return { ok: true, url: '' }

  try {
    if (!(await getContenedor(carpeta).getBlobClient(limpio).exists())) {
      return { ok: false, error: 'El archivo ya no existe.' }
    }
    return { ok: true, url: crearUrlFirmada(carpeta as Carpeta, limpio, 'lectura', limpio) }
  } catch (error) {
    console.error('Failed to create download url:', error)
    return { ok: false, error: 'No se pudo preparar la descarga.' }
  }
}

export async function borrarArchivo(
  carpeta: string,
  nombre: string
): Promise<Resultado<Record<never, never>>> {
  const auth = await requireRole(ROLES_CON_ARCHIVOS)
  if (!auth.ok) return auth
  if (!esCarpeta(carpeta) || !puedeBorrar(auth.profile.rol, carpeta)) {
    return { ok: false, error: 'Solo el supervisor puede borrar archivos.' }
  }

  const limpio = limpiarNombre(nombre)
  if (!limpio || limpio !== nombre) return { ok: false, error: 'Nombre de archivo no válido.' }

  if (isDevBypassActive()) {
    demoBorrar(carpeta, limpio)
    return { ok: true }
  }

  try {
    await getContenedor(carpeta).getBlobClient(limpio).deleteIfExists()
    return { ok: true }
  } catch (error) {
    console.error('Failed to delete blob:', error)
    return { ok: false, error: 'No se pudo borrar el archivo.' }
  }
}
