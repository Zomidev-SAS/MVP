'use client'

import { useState, type ReactNode } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface ChartSelectorItem {
  id: string
  label: string
  node: ReactNode
}

export function ChartSelector({ items }: { items: ChartSelectorItem[] }) {
  const [seleccionadoId, setSeleccionadoId] = useState(items[0]?.id)
  const actual = items.find((item) => item.id === seleccionadoId) ?? items[0]

  if (!actual) return null

  const opcionesSelect = Object.fromEntries(items.map((item) => [item.id, item.label]))

  return (
    <div className="space-y-4">
      <Select
        items={opcionesSelect}
        value={actual.id}
        onValueChange={(value) => value && setSeleccionadoId(value)}
      >
        <SelectTrigger className="w-full sm:w-80">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {actual.node}
    </div>
  )
}
