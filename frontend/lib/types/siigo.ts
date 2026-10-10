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
  producto?: SiigoValidacionProducto
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
