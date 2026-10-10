import type { VehiculoProceso } from '@/lib/types/vehiculo-proceso'

export function getDevPreviewProcesosVehiculo(chasis: string): VehiculoProceso[] {
  const ahora = Date.now()
  const DIA_MS = 24 * 60 * 60 * 1000

  return [
    {
      id: 'proceso-preview-1',
      chasis,
      titulo: 'Revisión inicial',
      procesoEstado: 'Diagnóstico',
      observaciones: 'Se detectó falla en sistema eléctrico.',
      seccionSiguiente: 'Metalmecánica',
      creadoPorNombre: 'Vista Previa Dev',
      creadoEn: new Date(ahora - 2 * DIA_MS).toISOString(),
    },
    {
      id: 'proceso-preview-2',
      chasis,
      titulo: 'Cambio de piezas',
      procesoEstado: 'En reparación',
      observaciones: null,
      seccionSiguiente: 'Instalación',
      creadoPorNombre: 'Vista Previa Dev',
      creadoEn: new Date(ahora - DIA_MS).toISOString(),
    },
  ]
}
