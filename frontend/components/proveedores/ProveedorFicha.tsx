'use client'

import { HistorialTabla } from '@/components/proveedores/HistorialTabla'
import { ReevaluacionPanel } from '@/components/proveedores/ReevaluacionPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ProveedorExportable } from '@/lib/export/proveedor-desempeno'
import type { ConfigDesempeno } from '@/lib/proveedores/desempeno'
import type { FilaHistorial } from '@/lib/proveedores/historial'
import type { Reevaluacion } from '@/lib/types/proveedor-reevaluacion'

interface ProveedorFichaProps {
  filas: FilaHistorial[]
  errorHistorial?: string
  config: ConfigDesempeno
  proveedorId: number
  proveedor: ProveedorExportable
  reevaluaciones: Reevaluacion[]
  errorReevaluaciones?: string
  ordenInicial: number | null
}

export function ProveedorFicha({
  filas,
  errorHistorial,
  config,
  proveedorId,
  proveedor,
  reevaluaciones,
  errorReevaluaciones,
  ordenInicial,
}: ProveedorFichaProps) {
  return (
    <Tabs defaultValue="historial" className="gap-4">
      <TabsList variant="line">
        <TabsTrigger value="historial">Historial y desempeño</TabsTrigger>
        <TabsTrigger value="reevaluacion">Reevaluación anual</TabsTrigger>
      </TabsList>

      <TabsContent value="historial">
        <HistorialTabla
          filas={filas}
          error={errorHistorial}
          proveedorId={proveedorId}
          proveedor={proveedor}
          config={config}
          ordenInicial={ordenInicial}
        />
      </TabsContent>

      <TabsContent value="reevaluacion">
        <ReevaluacionPanel
          filas={filas}
          config={config}
          proveedorId={proveedorId}
          proveedor={proveedor}
          reevaluaciones={reevaluaciones}
          error={errorReevaluaciones}
        />
      </TabsContent>
    </Tabs>
  )
}
