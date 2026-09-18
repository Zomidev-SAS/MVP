import type { MovimientoDetalle } from '@/lib/types/movimientos'

const TIPOS: MovimientoDetalle['tipo_movimiento'][] = ['entrada', 'salida_vin', 'ajuste', 'reverso']
const ESTADOS: MovimientoDetalle['estado'][] = ['aplicado', 'aplicado', 'aplicado', 'pendiente', 'rechazado']
const ACTORES = ['Juan Pérez', 'María Gómez', 'Carlos Ruiz']
const BODEGAS = [
  'Sin Asignar',
  'ALMACEN NIVEL 1',
  'ALMACEN NIVEL 2',
  'ALMACEN NIVEL 3',
  'METALMECANICA',
  'PRODUCTO TERMINADO',
  'MADERAS',
  'DESCANSABRAZOS',
  'AUDIO Y VIDEO',
]
const NOMBRES_PRODUCTO = [
  'TAPA DE ASIENTO',
  'BASE METALICA SILLA',
  'ESPUMA ALTA DENSIDAD',
  'TELA CHENILLE GRIS',
  'BRAZO METALICO RECLINABLE',
  'TABLERO MDF 18MM',
  'RIEL TELESCOPICO',
  'BISAGRA CODO 35MM',
]

export function getDevPreviewMovimientosData(): MovimientoDetalle[] {
  const baseDate = new Date('2026-08-01T00:00:00Z')

  return Array.from({ length: 60 }, (_, i) => {
    const tipo = TIPOS[i % TIPOS.length]
    const estado = ESTADOS[i % ESTADOS.length]

    return {
      id: i + 1,
      codigo_producto: `${10024 + (i % 20)}`,
      producto_nombre: NOMBRES_PRODUCTO[i % NOMBRES_PRODUCTO.length],
      tipo_movimiento: tipo,
      cantidad: 1 + (i % 10),
      valor_unitario: 5_000 + (i % 10) * 2_500,
      bodega: BODEGAS[i % BODEGAS.length],
      formulario_id: i % 3 === 0 ? `FORM-${1000 + i}` : null,
      motivo: estado === 'rechazado' ? 'Discrepancia con conteo físico' : null,
      actor_id: `a0000000-0000-0000-0000-00000000000${i % 3}`,
      actor_nombre: ACTORES[i % ACTORES.length],
      aprobado_por: estado === 'aplicado' ? `a0000000-0000-0000-0000-00000000000${i % 3}` : null,
      estado,
      created_at: new Date(baseDate.getTime() + i * 8 * 60 * 60 * 1000).toISOString(),
    }
  })
}
