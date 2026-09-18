export interface MovimientoDetalle {
  id: number
  codigo_producto: string
  producto_nombre: string | null
  tipo_movimiento: 'entrada' | 'salida_vin' | 'ajuste' | 'reverso'
  cantidad: number
  valor_unitario: number | null
  bodega: string | null
  formulario_id: string | null
  motivo: string | null
  actor_id: string
  actor_nombre: string | null
  aprobado_por: string | null
  estado: 'pendiente' | 'aplicado' | 'rechazado'
  created_at: string
}

export interface MovimientosFiltros {
  codigoProducto: string
  bodega: string
  tipo: 'todos' | 'entrada' | 'salida_vin' | 'ajuste' | 'reverso'
  desde: string
  hasta: string
}

export interface MovimientosPagina {
  filas: MovimientoDetalle[]
  total: number
}
