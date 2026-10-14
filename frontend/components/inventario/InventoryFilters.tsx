'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOpcionesFiltros } from '@/lib/hooks/use-opciones-filtros'
import type { InventarioFiltros } from '@/lib/types/inventario'

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs'

export function InventoryFilters({
  filtros,
  onChange,
}: {
  filtros: InventarioFiltros
  onChange: (filtros: InventarioFiltros) => void
}) {
  const { bodegas, categorias } = useOpcionesFiltros()

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
        <Label htmlFor="filtro-bodega">Bodega</Label>
        <select
          id="filtro-bodega"
          value={filtros.bodega}
          onChange={(e) => onChange({ ...filtros, bodega: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">Todas (total)</option>
          {bodegas.map((bodega) => (
            <option key={bodega.id} value={bodega.nombre}>
              {bodega.nombre}
            </option>
          ))}
        </select>
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
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.nombre}>
              {categoria.nombre}
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
