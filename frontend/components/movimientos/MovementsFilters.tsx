'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MovimientosFiltros } from '@/lib/types/movimientos'

export function MovementsFilters({
  filtros,
  onChange,
}: {
  filtros: MovimientosFiltros
  onChange: (filtros: MovimientosFiltros) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div className="space-y-1">
        <Label htmlFor="mov-filtro-vin">VIN</Label>
        <Input
          id="mov-filtro-vin"
          value={filtros.vin}
          onChange={(e) => onChange({ ...filtros, vin: e.target.value })}
          placeholder="Exacto"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="mov-filtro-tipo">Tipo</Label>
        <select
          id="mov-filtro-tipo"
          value={filtros.tipo}
          onChange={(e) =>
            onChange({ ...filtros, tipo: e.target.value as MovimientosFiltros['tipo'] })
          }
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
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
