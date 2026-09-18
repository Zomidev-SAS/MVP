'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MovimientosFiltros } from '@/lib/types/movimientos'

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs'

const BODEGAS_REALES = [
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

export function MovementsFilters({
  filtros,
  onChange,
}: {
  filtros: MovimientosFiltros
  onChange: (filtros: MovimientosFiltros) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      <div className="space-y-1">
        <Label htmlFor="mov-filtro-codigo">Código producto</Label>
        <Input
          id="mov-filtro-codigo"
          value={filtros.codigoProducto}
          onChange={(e) => onChange({ ...filtros, codigoProducto: e.target.value })}
          placeholder="Exacto"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="mov-filtro-bodega">Bodega</Label>
        <select
          id="mov-filtro-bodega"
          value={filtros.bodega}
          onChange={(e) => onChange({ ...filtros, bodega: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">Todas</option>
          {BODEGAS_REALES.map((bodega) => (
            <option key={bodega} value={bodega}>
              {bodega}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="mov-filtro-tipo">Tipo</Label>
        <select
          id="mov-filtro-tipo"
          value={filtros.tipo}
          onChange={(e) =>
            onChange({ ...filtros, tipo: e.target.value as MovimientosFiltros['tipo'] })
          }
          className={SELECT_CLASS}
        >
          <option value="todos">Todos</option>
          <option value="entrada">Entrada</option>
          <option value="salida_vin">Salida</option>
          <option value="ajuste">Ajuste</option>
          <option value="reverso">Reverso</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="mov-filtro-desde">Desde</Label>
        <Input
          id="mov-filtro-desde"
          type="date"
          value={filtros.desde}
          onChange={(e) => onChange({ ...filtros, desde: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="mov-filtro-hasta">Hasta</Label>
        <Input
          id="mov-filtro-hasta"
          type="date"
          value={filtros.hasta}
          onChange={(e) => onChange({ ...filtros, hasta: e.target.value })}
        />
      </div>
    </div>
  )
}
