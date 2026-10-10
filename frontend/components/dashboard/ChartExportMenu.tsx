'use client'

import { Download } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { buttonVariants } from '@/components/ui/button'
import { exportarChartComoPng, exportarDatosComoCsv } from '@/lib/export/chart-export'

interface ChartExportMenuProps<T extends object> {
  targetId: string
  data: T[]
  nombreArchivo: string
  disabled?: boolean // true si el rol no puede exportar esta gráfica (ej. costos)
}

export function ChartExportMenu<T extends object>({
  targetId,
  data,
  nombreArchivo,
  disabled,
}: ChartExportMenuProps<T>) {
  if (disabled) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        aria-label="Exportar gráfica"
      >
        <Download className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void exportarChartComoPng(targetId, nombreArchivo)}>
          Descargar imagen (PNG)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => exportarDatosComoCsv(data, nombreArchivo)}>
          Descargar datos (CSV)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
