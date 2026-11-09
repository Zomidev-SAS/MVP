'use server'

import { requireRole } from '@/lib/auth/require-role'
import { crearUrlFirmada, getContenedor } from '@/lib/archivos/azure'
import {
  ROLES_CON_ARCHIVOS,
  carpetasVisibles,
  esCarpeta,
  puedeBorrar,
  puedeModificar,
  puedeSubir,
  puedeVer,
  type Carpeta,
} from '@/lib/archivos/matriz'
import {
  MARCADOR,
  limpiarSegmento,
  nombreDe,
  normalizarRuta,
  padreDe,
  profundidad,
  unirRuta,
  MAX_PROFUNDIDAD,
} from '@/lib/archivos/rutas'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import {
  demoAgregar,
  demoBorrarArchivo,
  demoBorrarCarpeta,
  demoCrearCarpeta,
  demoExisteArchivo,
  demoExisteCarpeta,
  demoListar,
  demoRenombrar,
} from '@/lib/dev/preview-archivos-data'
import type { CarpetaItem, Contenido } from '@/lib/types/archivos'

type Resultado<T> = ({ ok: true } & T) | { ok: false; error: string }
type Vacio = Record<never, never>

const MAX_BYTES = 500 * 1024 * 1024
/** Tope de archivos que se mueven o borran en una sola operación de carpeta. */
const MAX_OPERACION = 1000

/** Traduce el fallo de Azure a algo que quien usa el panel pueda reportar sin ver los logs. */
function explicarFallo(error: unknown, porDefecto: string): string {
  const texto = error instanceof Error ? error.message : ''
  const status = (error as { statusCode?: number } | null)?.statusCode
  if (texto.includes('AZURE_STORAGE_CONNECTION_STRING')) {
    return 'El servidor no tiene configurada la conexión a Azure. Avisa a ZomiDev.'
  }
  if (texto.includes('AccountKey')) {
    return 'La clave de Azure configurada en el servidor no es válida. Avisa a ZomiDev.'
  }
  if (status === 403 || texto.includes('AuthenticationFailed')) {
    return 'Azure rechazó la clave del servidor (¿fue rotada?). Avisa a ZomiDev.'
  }
  return porDefecto
}

const NO_AUTORIZADO = 'No autorizado para esta carpeta.'

export async function listarCarpetas(): Promise<Resultado<{ carpetas: CarpetaItem[] }>> {
  const auth = await requireRole(ROLES_CON_ARCHIVOS)
  if (!auth.ok) return auth
  const rol = auth.profile.rol

  return {
    ok: true,
    carpetas: carpetasVisibles(rol).map((nombre) => ({
      nombre,
      puedeSubir: puedeSubir(rol, nombre),
      puedeModificar: puedeModificar(rol, nombre),
      puedeBorrar: puedeBorrar(rol, nombre),
    })),
  }
}

export async function listarContenido(carpeta: string, ruta: string): Promise<Resultado<Contenido>> {
  const auth = await requireRole(ROLES_CON_ARCHIVOS)
  if (!auth.ok) return auth
  const limpia = normalizarRuta(ruta)
  if (!esCarpeta(carpeta) || !puedeVer(auth.profile.rol, carpeta)) return { ok: false, error: NO_AUTORIZADO }
  if (limpia === null) return { ok: false, error: 'Ruta no válida.' }

  if (isDevBypassActive()) return { ok: true, ...demoListar(carpeta, limpia) }

  try {
    const contenedor = getContenedor(carpeta)
    await contenedor.createIfNotExists()
    const prefijo = limpia ? `${limpia}/` : ''
    const contenido: Contenido = { subcarpetas: [], archivos: [] }
    for await (const item of contenedor.listBlobsByHierarchy('/', { prefix: prefijo })) {
      if (item.kind === 'prefix') {
        const ruta = item.name.replace(/\/$/, '')
        contenido.subcarpetas.push({ nombre: nombreDe(ruta), ruta })
      } else if (nombreDe(item.name) !== MARCADOR) {
        contenido.archivos.push({
          nombre: nombreDe(item.name),
          ruta: item.name,
          tamano: item.properties.contentLength ?? 0,
          modificado: item.properties.lastModified?.toISOString() ?? null,
        })
      }
    }
    contenido.subcarpetas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    contenido.archivos.sort((a, b) => (b.modificado ?? '').localeCompare(a.modificado ?? ''))
    return { ok: true, ...contenido }
  } catch (error) {
    console.error('Failed to list blobs:', error)
    return { ok: false, error: explicarFallo(error, 'No se pudo leer la carpeta.') }
  }
}

export async function crearUrlSubida(
  carpeta: string,
  ruta: string,
  nombre: string,
  tamano: number
): Promise<Resultado<{ url: string; nombre: string }>> {
  const auth = await requireRole(ROLES_CON_ARCHIVOS)
  if (!auth.ok) return auth
  if (!esCarpeta(carpeta) || !puedeSubir(auth.profile.rol, carpeta)) {
    return { ok: false, error: 'No autorizado para subir a esta carpeta.' }
  }
  const dir = normalizarRuta(ruta)
  // El navegador entrega solo el nombre; se descarta cualquier ruta que traiga el archivo.
  const limpio = limpiarSegmento(nombre.split(/[\\/]/).pop() ?? '')
  if (dir === null || !limpio) return { ok: false, error: 'Nombre de archivo no válido.' }
  if (!Number.isFinite(tamano) || tamano <= 0 || tamano > MAX_BYTES) {
    return { ok: false, error: 'El archivo debe pesar entre 1 byte y 500 MB.' }
  }
  const destino = unirRuta(dir, limpio)

  if (isDevBypassActive()) {
    if (demoExisteArchivo(carpeta, destino) || demoExisteCarpeta(carpeta, destino)) {
      return { ok: false, error: `Ya existe "${limpio}" en esta carpeta.` }
    }
    demoAgregar(carpeta, destino, tamano)
    return { ok: true, url: '', nombre: limpio }
  }

  try {
    const contenedor = getContenedor(carpeta)
    await contenedor.createIfNotExists()
    if (await contenedor.getBlobClient(destino).exists()) {
      return { ok: false, error: `Ya existe "${limpio}" en esta carpeta.` }
    }
    return { ok: true, url: crearUrlFirmada(carpeta, destino, 'escritura'), nombre: limpio }
  } catch (error) {
    console.error('Failed to create upload url:', error)
    return { ok: false, error: explicarFallo(error, 'No se pudo preparar la subida.') }
  }
}

export async function crearUrlDescarga(carpeta: string, rutaArchivo: string): Promise<Resultado<{ url: string }>> {
  const auth = await requireRole(ROLES_CON_ARCHIVOS)
  if (!auth.ok) return auth
  if (!esCarpeta(carpeta) || !puedeVer(auth.profile.rol, carpeta)) return { ok: false, error: NO_AUTORIZADO }
  const ruta = normalizarRuta(rutaArchivo)
  if (!ruta) return { ok: false, error: 'Nombre de archivo no válido.' }

  if (isDevBypassActive()) return { ok: true, url: '' }

  try {
    if (!(await getContenedor(carpeta).getBlobClient(ruta).exists())) {
      return { ok: false, error: 'El archivo ya no existe.' }
    }
    return { ok: true, url: crearUrlFirmada(carpeta, ruta, 'lectura', nombreDe(ruta)) }
  } catch (error) {
    console.error('Failed to create download url:', error)
    return { ok: false, error: explicarFallo(error, 'No se pudo preparar la descarga.') }
  }
}

export async function crearSubcarpeta(
  carpeta: string,
  ruta: string,
  nombre: string
): Promise<Resultado<Vacio>> {
  const auth = await requireRole(ROLES_CON_ARCHIVOS)
  if (!auth.ok) return auth
  if (!esCarpeta(carpeta) || !puedeModificar(auth.profile.rol, carpeta)) {
    return { ok: false, error: 'No autorizado para crear carpetas aquí.' }
  }
  const dir = normalizarRuta(ruta)
  const limpio = limpiarSegmento(nombre)
  if (dir === null || !limpio) return { ok: false, error: 'Nombre de carpeta no válido.' }
  const nueva = unirRuta(dir, limpio)
  if (profundidad(nueva) > MAX_PROFUNDIDAD) {
    return { ok: false, error: `Máximo ${MAX_PROFUNDIDAD} niveles de carpetas.` }
  }

  if (isDevBypassActive()) {
    if (demoExisteCarpeta(carpeta, nueva) || demoExisteArchivo(carpeta, nueva)) {
      return { ok: false, error: `Ya existe "${limpio}" en esta carpeta.` }
    }
    demoCrearCarpeta(carpeta, nueva)
    return { ok: true }
  }

  try {
    const contenedor = getContenedor(carpeta)
    await contenedor.createIfNotExists()
    if (await existeAlgo(carpeta, nueva)) {
      return { ok: false, error: `Ya existe "${limpio}" en esta carpeta.` }
    }
    await contenedor.getBlockBlobClient(`${nueva}/${MARCADOR}`).upload('', 0)
    return { ok: true }
  } catch (error) {
    console.error('Failed to create folder:', error)
    return { ok: false, error: explicarFallo(error, 'No se pudo crear la carpeta.') }
  }
}

/** True si existe un archivo con esa ruta o algo dentro de una carpeta con esa ruta. */
async function existeAlgo(carpeta: Carpeta, ruta: string): Promise<boolean> {
  const contenedor = getContenedor(carpeta)
  if (await contenedor.getBlobClient(ruta).exists()) return true
  for await (const item of contenedor.listBlobsFlat({ prefix: `${ruta}/` })) {
    return item.name.length > 0
  }
  return false
}

export async function renombrar(
  carpeta: string,
  rutaActual: string,
  nuevoNombre: string,
  esDirectorio: boolean
): Promise<Resultado<Vacio>> {
  const auth = await requireRole(ROLES_CON_ARCHIVOS)
  if (!auth.ok) return auth
  if (!esCarpeta(carpeta) || !puedeModificar(auth.profile.rol, carpeta)) {
    return { ok: false, error: 'No autorizado para renombrar aquí.' }
  }
  const actual = normalizarRuta(rutaActual)
  const limpio = limpiarSegmento(nuevoNombre)
  if (!actual || !limpio) return { ok: false, error: 'Nombre no válido.' }
  if (limpio === nombreDe(actual)) return { ok: true }
  const nueva = unirRuta(padreDe(actual), limpio)

  if (isDevBypassActive()) {
    if (demoExisteCarpeta(carpeta, nueva) || demoExisteArchivo(carpeta, nueva)) {
      return { ok: false, error: `Ya existe "${limpio}" en esta carpeta.` }
    }
    demoRenombrar(carpeta, actual, limpio, esDirectorio)
    return { ok: true }
  }

  try {
    if (await existeAlgo(carpeta, nueva)) {
      return { ok: false, error: `Ya existe "${limpio}" en esta carpeta.` }
    }
    const origenes = esDirectorio ? await listarPrefijo(carpeta, actual) : [actual]
    if (origenes.length === 0) return { ok: false, error: 'No se encontró lo que quieres renombrar.' }
    if (origenes.length > MAX_OPERACION) {
      return { ok: false, error: `La carpeta tiene más de ${MAX_OPERACION} archivos. Divídela primero.` }
    }
    await copiarYBorrar(carpeta, origenes, (origen) => nueva + origen.slice(actual.length))
    return { ok: true }
  } catch (error) {
    console.error('Failed to rename:', error)
    return { ok: false, error: explicarFallo(error, 'No se pudo renombrar.') }
  }
}

async function listarPrefijo(carpeta: Carpeta, ruta: string): Promise<string[]> {
  const nombres: string[] = []
  for await (const item of getContenedor(carpeta).listBlobsFlat({ prefix: `${ruta}/` })) {
    nombres.push(item.name)
    if (nombres.length > MAX_OPERACION) break
  }
  return nombres
}

/** Copia en el servidor de Azure (sin bajar los datos) y borra el original solo si todas las copias salieron bien. */
async function copiarYBorrar(
  carpeta: Carpeta,
  origenes: string[],
  destinoDe: (origen: string) => string
): Promise<void> {
  const contenedor = getContenedor(carpeta)
  for (const origen of origenes) {
    const poller = await contenedor
      .getBlobClient(destinoDe(origen))
      .beginCopyFromURL(crearUrlFirmada(carpeta, origen, 'lectura'))
    await poller.pollUntilDone()
  }
  for (const origen of origenes) {
    await contenedor.getBlobClient(origen).deleteIfExists()
  }
}

export async function borrarArchivo(carpeta: string, rutaArchivo: string): Promise<Resultado<Vacio>> {
  const auth = await requireRole(ROLES_CON_ARCHIVOS)
  if (!auth.ok) return auth
  if (!esCarpeta(carpeta) || !puedeBorrar(auth.profile.rol, carpeta)) {
    return { ok: false, error: 'Solo el supervisor puede borrar archivos.' }
  }
  const ruta = normalizarRuta(rutaArchivo)
  if (!ruta) return { ok: false, error: 'Nombre de archivo no válido.' }

  if (isDevBypassActive()) {
    demoBorrarArchivo(carpeta, ruta)
    return { ok: true }
  }

  try {
    await getContenedor(carpeta).getBlobClient(ruta).deleteIfExists()
    return { ok: true }
  } catch (error) {
    console.error('Failed to delete blob:', error)
    return { ok: false, error: explicarFallo(error, 'No se pudo borrar el archivo.') }
  }
}

export async function borrarSubcarpeta(carpeta: string, ruta: string): Promise<Resultado<{ borrados: number }>> {
  const auth = await requireRole(ROLES_CON_ARCHIVOS)
  if (!auth.ok) return auth
  if (!esCarpeta(carpeta) || !puedeBorrar(auth.profile.rol, carpeta)) {
    return { ok: false, error: 'Solo el supervisor puede borrar carpetas.' }
  }
  const limpia = normalizarRuta(ruta)
  if (!limpia) return { ok: false, error: 'Ruta no válida.' }

  if (isDevBypassActive()) {
    demoBorrarCarpeta(carpeta, limpia)
    return { ok: true, borrados: 0 }
  }

  try {
    const nombres = await listarPrefijo(carpeta, limpia)
    if (nombres.length > MAX_OPERACION) {
      return { ok: false, error: `La carpeta tiene más de ${MAX_OPERACION} archivos. Bórrala por partes.` }
    }
    const contenedor = getContenedor(carpeta)
    for (const nombre of nombres) await contenedor.getBlobClient(nombre).deleteIfExists()
    return { ok: true, borrados: nombres.filter((n) => nombreDe(n) !== MARCADOR).length }
  } catch (error) {
    console.error('Failed to delete folder:', error)
    return { ok: false, error: explicarFallo(error, 'No se pudo borrar la carpeta.') }
  }
}
