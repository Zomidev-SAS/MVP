import type { Carpeta } from '@/lib/archivos/matriz'

export interface CarpetaItem {
  nombre: Carpeta
  puedeSubir: boolean
  puedeModificar: boolean
  puedeBorrar: boolean
}

export interface SubcarpetaItem {
  nombre: string
  /** Ruta completa dentro del contenedor, sin barra final. */
  ruta: string
}

export interface ArchivoItem {
  nombre: string
  /** Ruta completa dentro del contenedor. */
  ruta: string
  tamano: number
  modificado: string | null
}

export interface Contenido {
  subcarpetas: SubcarpetaItem[]
  archivos: ArchivoItem[]
}
