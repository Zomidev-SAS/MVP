export interface MovimientoDetalle {
  id: number
  vin: string
  tipo_movimiento: 'entrada' | 'salida_vin' | 'ajuste' | 'reverso'
  cantidad: number
  valor_unitario: number | null
  marca: string | null
  categoria: string | null
  ubicacion: string | null
  formulario_id: string | null
  motivo: string | null
  actor_nombre: string | null
  aprobado_por: string | null
  estado: 'pendiente' | 'aplicado' | 'rechazado'
  created_at: string
}

export interface MovimientosFiltros {
  vin: string
  tipo: 'todos' | 'entrada' | 'salida_vin' | 'ajuste' | 'reverso'
  desde: string
  hasta: string
}

export interface MovimientosPagina {
  filas: MovimientoDetalle[]
  total: number
}
