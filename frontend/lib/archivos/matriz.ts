import type { Role } from '@/lib/types/database'

/** Nombres de contenedor en Azure (cuenta stcarreraarango). Orden = orden en pantalla. */
export const CARPETAS = [
  'administracion',
  'almacen',
  'calidad',
  'comercial',
  'compras',
  'contabilidad',
  'ingenieria',
  'produccion',
  'recepcion',
  'recursos-humanos',
  'ssst',
  'respaldos',
] as const

export type Carpeta = (typeof CARPETAS)[number]

export const CARPETA_LABELS: Record<Carpeta, string> = {
  administracion: 'Administración',
  almacen: 'Almacén',
  calidad: 'Calidad',
  comercial: 'Comercial',
  compras: 'Compras',
  contabilidad: 'Contabilidad',
  ingenieria: 'Ingeniería',
  produccion: 'Producción',
  recepcion: 'Recepción',
  'recursos-humanos': 'Recursos Humanos',
  ssst: 'SSST',
  respaldos: 'Respaldos',
}

interface Permisos {
  ver: readonly Role[]
  subir: readonly Role[]
}

/**
 * Matriz aprobada por el dueño. Supervisor ve y sube en todas las carpetas
 * y es el único que borra (ver PUEDE_BORRAR). `respaldos` no admite subidas
 * desde el panel: solo la migración hecha por ZomiDev.
 */
const MATRIZ: Record<Carpeta, Permisos> = {
  administracion: { ver: ['supervisor', 'auditoria'], subir: ['supervisor'] },
  almacen: {
    ver: ['supervisor', 'compras', 'produccion', 'metalmecanica', 'instalacion', 'auditoria'],
    subir: ['supervisor', 'compras'],
  },
  calidad: {
    ver: ['supervisor', 'metalmecanica', 'produccion', 'instalacion', 'auditoria'],
    subir: ['supervisor', 'metalmecanica', 'produccion'],
  },
  comercial: { ver: ['supervisor', 'comercial', 'auditoria'], subir: ['supervisor', 'comercial'] },
  compras: {
    ver: ['supervisor', 'compras', 'comercial', 'auditoria'],
    subir: ['supervisor', 'compras'],
  },
  contabilidad: { ver: ['supervisor', 'auditoria'], subir: ['supervisor'] },
  ingenieria: {
    ver: ['supervisor', 'metalmecanica', 'produccion', 'instalacion', 'auditoria'],
    subir: ['supervisor', 'metalmecanica'],
  },
  produccion: {
    ver: ['supervisor', 'metalmecanica', 'produccion', 'instalacion', 'auditoria', 'lectura'],
    subir: ['supervisor', 'metalmecanica', 'produccion', 'instalacion'],
  },
  recepcion: { ver: ['supervisor', 'comercial'], subir: ['supervisor'] },
  'recursos-humanos': { ver: ['supervisor'], subir: ['supervisor'] },
  ssst: {
    ver: ['supervisor', 'metalmecanica', 'produccion', 'instalacion', 'auditoria'],
    subir: ['supervisor'],
  },
  respaldos: { ver: ['supervisor', 'auditoria'], subir: [] },
}

const PUEDE_BORRAR: readonly Role[] = ['supervisor']

/** Roles que ven al menos una carpeta; gobierna la ruta /archivos. */
export const ROLES_CON_ARCHIVOS: readonly Role[] = Array.from(
  new Set(Object.values(MATRIZ).flatMap((p) => p.ver))
)

export function esCarpeta(valor: string): valor is Carpeta {
  return (CARPETAS as readonly string[]).includes(valor)
}

export function puedeVer(rol: Role, carpeta: Carpeta): boolean {
  return MATRIZ[carpeta].ver.includes(rol)
}

export function puedeSubir(rol: Role, carpeta: Carpeta): boolean {
  return MATRIZ[carpeta].subir.includes(rol)
}

export function puedeBorrar(rol: Role, carpeta: Carpeta): boolean {
  return puedeVer(rol, carpeta) && PUEDE_BORRAR.includes(rol)
}

/** Crear y renombrar carpetas o archivos: quien puede subir en esa carpeta. Borrar sigue siendo solo del supervisor. */
export function puedeModificar(rol: Role, carpeta: Carpeta): boolean {
  return puedeSubir(rol, carpeta)
}

export function carpetasVisibles(rol: Role): Carpeta[] {
  return CARPETAS.filter((c) => puedeVer(rol, c))
}
