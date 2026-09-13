export interface InventarioItem {
  codigo: string
  nombre: string | null
  /** Solo aplica cuando la fila viene de Supabase (vehículos) */
  vin: string | null
  marca: string | null
  categoria: string | null
  ubicacion: string | null
  unidad: string | null
  saldo: number
  valor_unitario: number | null
  valor_total: number
  ultimo_movimiento: string | null
}

export interface InventarioFiltros {
  busqueda: string
  vin: string
  marca: string
  categoria: string
  ubicacion: string
  estado: 'todos' | 'activo' | 'agotado'
  desde: string
  hasta: string
}

export interface InventarioPagina {
  filas: InventarioItem[]
  total: number
  fuente: 'excel' | 'supabase'
  /** excel en Supabase (equipo) vs excel en disco (solo quien lo tiene) */
  origen?: 'nube' | 'local'
  fechaCorte?: string | null
  archivoLocal?: string | null
}
