'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { InventarioFiltros } from '@/lib/types/inventario'

export function InventoryFilters({
  filtros,
  onChange,
}: {
  filtros: InventarioFiltros
  onChange: (filtros: InventarioFiltros) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      <div className="space-y-1">
        <Label htmlFor="filtro-vin">VIN</Label>
        <Input
          id="filtro-vin"
          value={filtros.vin}
          onChange={(e) => onChange({ ...filtros, vin: e.target.value })}
          placeholder="Exacto"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="filtro-marca">Marca</Label>
        <Input
          id="filtro-marca"
          value={filtros.marca}
          onChange={(e) => onChange({ ...filtros, marca: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="filtro-categoria">Categoría</Label>
        <Input
          id="filtro-categoria"
          value={filtros.categoria}
          onChange={(e) => onChange({ ...filtros, categoria: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="filtro-estado">Estado</Label>
        <select
          id="filtro-estado"
          value={filtros.estado}
          onChange={(e) =>
            onChange({ ...filtros, estado: e.target.value as InventarioFiltros['estado'] })
          }
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
        >
          <option value="todos">Todos</option>
          <option value="activo">Activo</option>
          <option value="agotado">Agotado</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="filtro-desde">Desde</Label>
        <Input
          id="filtro-desde"
          type="date"
          value={filtros.desde}
          onChange={(e) => onChange({ ...filtros, desde: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="filtro-hasta">Hasta</Label>
        <Input
          id="filtro-hasta"
          type="date"
          value={filtros.hasta}
          onChange={(e) => onChange({ ...filtros, hasta: e.target.value })}
        />
      </div>
    </div>
  )
}
