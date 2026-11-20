import type { Carpeta } from '@/lib/archivos/matriz'

export interface CarpetaItem {
  nombre: Carpeta
  puedeSubir: boolean
  puedeBorrar: boolean
}

export interface ArchivoItem {
  nombre: string
  tamano: number
  modificado: string | null
}
