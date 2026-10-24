// frontend/lib/types/automatizaciones.ts
// `id` es el nombre de `regla` tal como lo registra log_automatizaciones
// (docs/CONTRATO_DATOS_SECCION2.md, sección 7) — no un enum cerrado, porque
// el backend puede agregar reglas nuevas sin que el frontend se entere.
export type ResultadoAutomatizacion = 'ok' | 'error' | 'parcial' | 'sin_ejecutar' | 'en_curso'

export interface AutomatizacionEstado {
  id: string
  nombre: string
  descripcion: string
  horario: string // cron humano, ej "cada 15 minutos"
  ultimaEjecucion: string | null
  resultado: ResultadoAutomatizacion
  error: string | null
}
