export interface SiigoValidacionProducto {
  encontrado: boolean
  code?: string
  name?: string
  active?: boolean
}

export interface SiigoValidacionProveedor {
  encontrado: boolean
  identification?: string
  name?: string
  active?: boolean
}

export interface SiigoValidacionResultado {
  ok: boolean
  producto?: SiigoValidacionProducto | null
  proveedor?: SiigoValidacionProveedor | null
  error?: string
}

export type EstadoSyncSiigo = 'pendiente' | 'enviando' | 'sincronizada' | 'error'

export interface SiigoSyncInfo {
  estado: EstadoSyncSiigo
  referencia: string | null
  fecha: string | null
  error: string | null
}

export interface SiigoCatalogoDiferencia {
  id: number
  tipo: 'producto' | 'proveedor'
  codigo: string
  campo: string
  valorPanel: string | null
  valorSiigo: string | null
  creadoEn: string
}

export interface SiigoCatalogoEstado {
  diferencias: SiigoCatalogoDiferencia[]
  ultimaSincronizacion: {
    fecha: string | null
    resultado: 'en_curso' | 'ok' | 'error' | null
    error: string | null
  } | null
}
