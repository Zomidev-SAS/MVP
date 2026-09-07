export interface InventarioItem {
  vin: string
  marca: string | null
  categoria: string | null
  ubicacion: string | null
  saldo: number
  valor_unitario: number | null
  valor_total: number
  ultimo_movimiento: string
}

export interface InventarioFiltros {
  vin: string
  marca: string
  categoria: string
  estado: 'todos' | 'activo' | 'agotado'
  desde: string
  hasta: string
}

export interface InventarioPagina {
  filas: InventarioItem[]
  total: number
}
