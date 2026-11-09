export interface InventarioItem {
  codigo_producto: string
  nombre_producto: string | null
  unidad_medida: string | null
  categoria: string | null
  saldo: number
  valor_unitario: number | null
  valor_total: number | null
  ultimo_movimiento: string | null
  /** Umbral de stock bajo que aplica al producto (propio, de su categoría o general). Antes de la migración 075 no viene. */
  umbral_stock?: number | null
  /** 'critico' (rojo), 'bajo' (amarillo) u 'ok'. Viene con la migración 078. */
  nivel_stock?: 'critico' | 'bajo' | 'ok'
}

export interface InventarioFiltros {
  busqueda: string
  categoria: string
  bodega: string
  estado: 'todos' | 'activo' | 'agotado' | 'critico' | 'bajo'
  desde: string
  hasta: string
}

export interface InventarioPagina {
  filas: InventarioItem[]
  total: number
}
