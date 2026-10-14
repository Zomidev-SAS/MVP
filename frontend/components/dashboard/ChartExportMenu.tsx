'use client'

import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { buttonVariants } from '@/components/ui/button'
import { exportarChartComoPng, exportarChartComoSvg, exportarDatosComoCsv } from '@/lib/export/chart-export'

interface ChartExportMenuProps<T extends object> {
  targetId: string
  data: T[]
  nombreArchivo: string
  disabled?: boolean // true si el rol no puede exportar esta gráfica (ej. costos)
}

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo exportar la gráfica'
}

export function ChartExportMenu<T extends object>({
  targetId,
  data,
  nombreArchivo,
  disabled,
}: ChartExportMenuProps<T>) {
  if (disabled) return null

  const descargarPng = async () => {
    try {
      await exportarChartComoPng(targetId, nombreArchivo)
    } catch (error) {
      toast.error(mensajeError(error))
    }
  }

  const descargarSvg = () => {
    try {
      exportarChartComoSvg(targetId, nombreArchivo)
    } catch (error) {
      toast.error(mensajeError(error))
    }
  }

  const descargarCsv = () => {
    try {
      exportarDatosComoCsv(data, nombreArchivo)
    } catch (error) {
      toast.error(mensajeError(error))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        aria-label="Exportar gráfica"
      >
        <Download className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void descargarPng()}>
          Descargar imagen (PNG)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={descargarSvg}>Descargar vector (SVG)</DropdownMenuItem>
        <DropdownMenuItem onClick={descargarCsv}>Descargar datos (CSV)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
