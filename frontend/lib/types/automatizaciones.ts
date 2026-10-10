// frontend/lib/types/automatizaciones.ts
export type AutomatizacionId =
  | 'stock_bajo'
  | 'recordatorios'
  | 'oc_vencidas'
  | 'cierre_diario'
  | 'reintentos_vin'
  | 'sincronizacion_siigo'
  | 'cola_correos'
  | 'reporte_semanal'

export type ResultadoAutomatizacion = 'ok' | 'error' | 'parcial' | 'sin_ejecutar'

export interface AutomatizacionEstado {
  id: AutomatizacionId
  nombre: string
  descripcion: string
  horario: string // cron humano, ej "cada 15 minutos"
  ultimaEjecucion: string | null
  resultado: ResultadoAutomatizacion
  error: string | null
}
