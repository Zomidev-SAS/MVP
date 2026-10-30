'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { OpcionFiltro } from '@/lib/formularios/opciones-filtro'
import type { FormulariosFiltros } from '@/lib/types/formularios'
import {
  UBICACION_SIN_CLASIFICAR,
  UBICACIONES_PARQUEADERO,
} from '@/lib/formularios/ubicacion-parqueadero'

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs'

export function FormulariosFilters({
  filtros,
  opcionesFiltro,
  onChange,
}: {
  filtros: FormulariosFiltros
  opcionesFiltro: OpcionFiltro[]
  onChange: (filtros: FormulariosFiltros) => void
}) {
  const grupos = agruparOpciones(opcionesFiltro)

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-1">
        <Label htmlFor="form-filtro-tipo">Tipo</Label>
        <select
          id="form-filtro-tipo"
          value={filtros.tipo}
          onChange={(e) =>
            onChange({ ...filtros, tipo: e.target.value as FormulariosFiltros['tipo'] })
          }
          className={SELECT_CLASS}
        >
          <option value="todos">Todos</option>
          <option value="entrada">Entrada</option>
          <option value="salida">Salida</option>
          <option value="parqueadero">Parqueadero</option>
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="form-filtro-ubicacion">Ubicación parqueadero</Label>
        <select
          id="form-filtro-ubicacion"
          value={filtros.ubicacion}
          onChange={(e) => onChange({ ...filtros, ubicacion: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="todas">Todas</option>
          {UBICACIONES_PARQUEADERO.map((ubicacion) => (
            <option key={ubicacion} value={ubicacion}>
              {ubicacion}
            </option>
          ))}
          <option value={UBICACION_SIN_CLASIFICAR}>Sin clasificar</option>
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="form-filtro-busqueda">Buscar</Label>
        <Input
          id="form-filtro-busqueda"
          value={filtros.busqueda}
          onChange={(e) => onChange({ ...filtros, busqueda: e.target.value })}
          placeholder="Chasis, conductor, cédula..."
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="form-filtro-lista">Filtros</Label>
        <select
          id="form-filtro-lista"
          value={filtros.filtros}
          onChange={(e) => onChange({ ...filtros, filtros: e.target.value })}
          className={SELECT_CLASS}
        >
          {grupos.map(({ grupo, opciones }) => (
            <optgroup key={grupo} label={grupo}>
              {opciones.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  )
}

function agruparOpciones(opciones: OpcionFiltro[]): Array<{ grupo: string; opciones: OpcionFiltro[] }> {
  const mapa = new Map<string, OpcionFiltro[]>()

  for (const opcion of opciones) {
    const lista = mapa.get(opcion.grupo) ?? []
    lista.push(opcion)
    mapa.set(opcion.grupo, lista)
  }

  const ordenGrupos = ['General', 'Marca', 'Ciudad', 'Empresa', 'Tipo vehículo']

  return ordenGrupos
    .filter((grupo) => mapa.has(grupo))
    .map((grupo) => ({ grupo, opciones: mapa.get(grupo)! }))
}
