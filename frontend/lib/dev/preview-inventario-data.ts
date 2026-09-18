import type { InventarioItem } from '@/lib/types/inventario'

const CATEGORIAS = [
  'TORNILLERIA',
  'MECANIZADOS',
  'PERFILERIA',
  'TELAS Y TAPICERIA',
  'DESCANSABRAZOS',
  'PRODUCTO TERMINADO',
  'INSUMOS VARIOS',
  'FIBRA',
  'AUDIO Y VIDEO',
]

const UNIDADES = ['unidad', 'kg', 'metro']

const NOMBRES = [
  'TAPA DE ASIENTO',
  'BASE METALICA SILLA',
  'ESPUMA ALTA DENSIDAD',
  'TELA CHENILLE GRIS',
  'TORNILLO AUTOPERFORANTE 1/2',
  'BRAZO METALICO RECLINABLE',
  'TABLERO MDF 18MM',
  'RIEL TELESCOPICO',
  'BISAGRA CODO 35MM',
  'PARLANTE 4 PULGADAS',
  'CONTROL REMOTO RECLINACION',
  'MOTOR RECLINABLE 12V',
  'ESPONJA RECUBRIMIENTO',
  'PATA DE MADERA TORNEADA',
  'CINTA DE FIJACION',
  'CREMALLERA METALICA',
  'SOPORTE DESCANSABRAZOS',
  'AMORTIGUADOR RECLINACION',
  'CABLE DE ALIMENTACION',
  'FUNDA PROTECTORA',
]

export function getDevPreviewInventarioData(): InventarioItem[] {
  const baseDate = new Date('2026-08-01T00:00:00Z')

  return NOMBRES.map((nombre, i) => {
    const codigoProducto = `${10024 + i}`
    const categoria = CATEGORIAS[i % CATEGORIAS.length]
    const unidadMedida = UNIDADES[i % UNIDADES.length]
    const saldo = i % 15
    const valorUnitario = 5_000 + (i % 10) * 2_500
    const ultimoMovimiento = new Date(baseDate.getTime() + i * 6 * 60 * 60 * 1000).toISOString()

    return {
      codigo_producto: codigoProducto,
      nombre_producto: nombre,
      unidad_medida: unidadMedida,
      categoria,
      saldo,
      valor_unitario: valorUnitario,
      valor_total: saldo * valorUnitario,
      ultimo_movimiento: ultimoMovimiento,
    }
  })
}
