'use client'

import { useDashboardFilters } from '@/lib/hooks/use-dashboard-filters'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Opcion {
  id: string
  nombre: string
}

interface DashboardFiltersProps {
  bodegas: Opcion[]
  categorias: Opcion[]
}

const RANGO_LABELS: Record<string, string> = {
  hoy: 'Hoy',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
  personalizado: 'Personalizado',
}

export function DashboardFilters({ bodegas, categorias }: DashboardFiltersProps) {
  const { filtros, setRango, setBodega, setCategoria } = useDashboardFilters()

  const bodegaItems = {
    todas: 'Todas las bodegas',
    ...Object.fromEntries(bodegas.map((b) => [b.id, b.nombre])),
  }
  const categoriaItems = {
    todas: 'Todas las categorías',
    ...Object.fromEntries(categorias.map((c) => [c.id, c.nombre])),
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        items={RANGO_LABELS}
        value={filtros.rango}
        onValueChange={(v) => setRango(v as typeof filtros.rango)}
      >
        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          {Object.entries(RANGO_LABELS).map(([valor, label]) => (
            <SelectItem key={valor} value={valor}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={bodegaItems}
        value={filtros.bodegaId ?? 'todas'}
        onValueChange={(v) => setBodega(v === 'todas' ? null : v)}
      >
        <SelectTrigger className="w-48"><SelectValue placeholder="Todas las bodegas" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas las bodegas</SelectItem>
          {bodegas.map((b) => (
            <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={categoriaItems}
        value={filtros.categoriaId ?? 'todas'}
        onValueChange={(v) => setCategoria(v === 'todas' ? null : v)}
      >
        <SelectTrigger className="w-48"><SelectValue placeholder="Todas las categorías" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas las categorías</SelectItem>
          {categorias.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
