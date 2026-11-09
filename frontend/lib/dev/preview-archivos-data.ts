import type { Carpeta } from '@/lib/archivos/matriz'
import { MARCADOR, padreDe } from '@/lib/archivos/rutas'
import type { Contenido } from '@/lib/types/archivos'

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString()

/** Archivos de muestra solo para el modo vista previa (DEV_SKIP_AUTH). Viven en memoria del servidor de desarrollo. */
interface Entrada {
  nombre: string
  tamano: number
  modificado: string | null
}

/** `nombre` es la ruta completa dentro de la carpeta ("Modelo B/plano.dwg"). */
const store: Partial<Record<Carpeta, Entrada[]>> = {
  administracion: [{ nombre: 'Acta-junta-octubre.pdf', tamano: 412_000, modificado: hace(6) }],
  almacen: [
    { nombre: 'Inventario-fisico-2026.xlsx', tamano: 1_840_000, modificado: hace(2) },
    { nombre: 'Guia-recepcion-mercancia.pdf', tamano: 220_500, modificado: hace(15) },
  ],
  calidad: [{ nombre: 'Protocolo-inspeccion-carroceria.pdf', tamano: 980_000, modificado: hace(4) }],
  comercial: [
    { nombre: 'Cotizacion-bus-escolar-0187.pdf', tamano: 356_000, modificado: hace(1) },
    { nombre: 'Catalogo-transformaciones.pdf', tamano: 5_200_000, modificado: hace(30) },
  ],
  compras: [{ nombre: 'OC-2026-0453.pdf', tamano: 128_000, modificado: hace(3) }],
  contabilidad: [{ nombre: 'Balance-septiembre.xlsx', tamano: 760_000, modificado: hace(8) }],
  ingenieria: [
    { nombre: 'Modelo B/Plano-chasis-modelo-B.dwg', tamano: 14_300_000, modificado: hace(5) },
    { nombre: 'Modelo B/Lista-materiales-modelo-B.xlsx', tamano: 310_000, modificado: hace(5) },
  ],
  produccion: [
    { nombre: 'Fotos/Foto-linea-soldadura.jpg', tamano: 2_900_000, modificado: hace(0) },
    { nombre: 'Orden-produccion-0812.pdf', tamano: 190_000, modificado: hace(2) },
  ],
  recepcion: [{ nombre: 'Registro-visitas-noviembre.pdf', tamano: 88_000, modificado: hace(1) }],
  'recursos-humanos': [{ nombre: 'Reglamento-interno.pdf', tamano: 1_100_000, modificado: hace(60) }],
  ssst: [{ nombre: 'Matriz-de-riesgos.xlsx', tamano: 540_000, modificado: hace(12) }],
  respaldos: [{ nombre: 'respaldo-servidor-2026-10-31.zip', tamano: 1_800_000_000, modificado: hace(2) }],
}

const lista = (carpeta: Carpeta): Entrada[] => store[carpeta] ?? []

export function demoListar(carpeta: Carpeta, ruta: string): Contenido {
  const prefijo = ruta ? `${ruta}/` : ''
  const nombresCarpeta = new Set<string>()
  const archivos: Contenido['archivos'] = []
  for (const e of lista(carpeta)) {
    if (!e.nombre.startsWith(prefijo)) continue
    const resto = e.nombre.slice(prefijo.length)
    const i = resto.indexOf('/')
    if (i !== -1) {
      nombresCarpeta.add(resto.slice(0, i))
    } else if (resto !== MARCADOR) {
      archivos.push({ nombre: resto, ruta: e.nombre, tamano: e.tamano, modificado: e.modificado })
    }
  }
  archivos.sort((a, b) => (b.modificado ?? '').localeCompare(a.modificado ?? ''))
  const subcarpetas = [...nombresCarpeta]
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((nombre) => ({ nombre, ruta: `${prefijo}${nombre}` }))
  return { subcarpetas, archivos }
}

export function demoExisteArchivo(carpeta: Carpeta, ruta: string): boolean {
  return lista(carpeta).some((e) => e.nombre === ruta)
}

export function demoExisteCarpeta(carpeta: Carpeta, ruta: string): boolean {
  return lista(carpeta).some((e) => e.nombre.startsWith(`${ruta}/`))
}

export function demoAgregar(carpeta: Carpeta, nombre: string, tamano: number): void {
  store[carpeta] = [...lista(carpeta), { nombre, tamano, modificado: new Date().toISOString() }]
}

export function demoCrearCarpeta(carpeta: Carpeta, ruta: string): void {
  demoAgregar(carpeta, `${ruta}/${MARCADOR}`, 0)
}

export function demoBorrarArchivo(carpeta: Carpeta, ruta: string): void {
  store[carpeta] = lista(carpeta).filter((e) => e.nombre !== ruta)
}

export function demoBorrarCarpeta(carpeta: Carpeta, ruta: string): void {
  store[carpeta] = lista(carpeta).filter((e) => !e.nombre.startsWith(`${ruta}/`))
}

export function demoRenombrar(carpeta: Carpeta, ruta: string, nuevoNombre: string, esCarpeta: boolean): void {
  const nueva = padreDe(ruta) ? `${padreDe(ruta)}/${nuevoNombre}` : nuevoNombre
  store[carpeta] = lista(carpeta).map((e) => {
    if (esCarpeta && e.nombre.startsWith(`${ruta}/`)) return { ...e, nombre: nueva + e.nombre.slice(ruta.length) }
    if (!esCarpeta && e.nombre === ruta) return { ...e, nombre: nueva }
    return e
  })
}
