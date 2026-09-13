'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { InventarioFiltros } from '@/lib/types/inventario'

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs'

export function InventoryFilters({
  filtros,
  fuente,
  onChange,
}: {
  filtros: InventarioFiltros
  fuente: 'excel' | 'supabase'
  onChange: (filtros: InventarioFiltros) => void
}) {
  const esExcel = fuente === 'excel'

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1 lg:col-span-2">
        <Label htmlFor="filtro-busqueda">Buscar</Label>
        <Input
          id="filtro-busqueda"
          value={filtros.busqueda}
          onChange={(e) => onChange({ ...filtros, busqueda: e.target.value })}
          placeholder={
            esExcel
              ? 'Código, nombre, categoría, ubicación...'
              : 'VIN, marca, categoría...'
          }
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
        <Label htmlFor="filtro-ubicacion">Ubicación</Label>
        <Input
          id="filtro-ubicacion"
          value={filtros.ubicacion}
          onChange={(e) => onChange({ ...filtros, ubicacion: e.target.value })}
          placeholder={esExcel ? 'Ej. ALMACEN NIVEL 2' : ''}
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
          className={SELECT_CLASS}
        >
          <option value="todos">Todos</option>
          <option value="activo">Con stock</option>
          <option value="agotado">Sin stock</option>
        </select>
      </div>

      {!esExcel && (
        <>
          <div className="space-y-1">
            <Label htmlFor="filtro-vin">VIN exacto</Label>
            <Input
              id="filtro-vin"
              value={filtros.vin}
              onChange={(e) => onChange({ ...filtros, vin: e.target.value })}
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
        </>
      )}
    </div>
  )
}
