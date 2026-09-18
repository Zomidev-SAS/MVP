'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { InventarioFiltros } from '@/lib/types/inventario'

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs'

const CATEGORIAS_REALES = [
  'TORNILLERIA',
  'Productos',
  'MECANIZADOS',
  'PERFILERIA',
  'TELAS Y TAPICERIA',
  'DESCANSABRAZOS',
  'PRODUCTO TERMINADO',
  'Productos CA',
  'Otro CA',
  'INSUMOS VARIOS',
  'FIBRA',
  'ELECTRICOS',
  'CORTE LASER',
  'PEGANTES E INFLAMABLES',
  'AUDIO Y VIDEO',
  'CA IMPORTACIONES',
  'Servicios',
]

export function InventoryFilters({
  filtros,
  onChange,
}: {
  filtros: InventarioFiltros
  onChange: (filtros: InventarioFiltros) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1 lg:col-span-2">
        <Label htmlFor="filtro-busqueda">Buscar</Label>
        <Input
          id="filtro-busqueda"
          value={filtros.busqueda}
          onChange={(e) => onChange({ ...filtros, busqueda: e.target.value })}
          placeholder="Código o nombre de producto..."
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="filtro-categoria">Categoría</Label>
        <select
          id="filtro-categoria"
          value={filtros.categoria}
          onChange={(e) => onChange({ ...filtros, categoria: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">Todas</option>
          {CATEGORIAS_REALES.map((categoria) => (
            <option key={categoria} value={categoria}>
              {categoria}
            </option>
          ))}
        </select>
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
