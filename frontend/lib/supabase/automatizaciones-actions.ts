'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { PREVIEW_AUTOMATIZACIONES } from '@/lib/dev/preview-automatizaciones-data'
import type { AutomatizacionEstado } from '@/lib/types/automatizaciones'

// Etiquetas legibles por `regla` (docs/CONTRATO_DATOS_SECCION2.md, sección 7
// y 12). Cualquier regla nueva que el backend agregue y no esté aquí se
// muestra igual, con un nombre genérico (ver fallback abajo) en vez de
// desaparecer de la pantalla.
const ETIQUETAS_REGLA: Record<string, { nombre: string; descripcion: string; horario: string }> = {
  cierre_diario_kpi: {
    nombre: 'Cierre diario',
    descripcion: 'Consolida movimientos del día en kpi_diario.',
    horario: 'Diario 11:55 p.m.',
  },
  recordatorio_ajustes_pendientes: {
    nombre: 'Recordatorios de ajustes',
    descripcion: 'Avisa ajustes pendientes hace más de 24 horas.',
    horario: 'Diario 8:00 a.m.',
  },
  aviso_oc_vencidas: {
    nombre: 'OC vencidas',
    descripcion: 'Notifica órdenes de compra vencidas.',
    horario: 'Diario 8:05 a.m.',
  },
  reintentar_sync_pendientes: {
    nombre: 'Reintentos VIN/Siigo',
    descripcion: 'Reintenta sincronizaciones de VIN y Siigo que fallaron.',
    horario: 'Cada 5 minutos',
  },
  limpiar_notificaciones_leidas: {
    nombre: 'Limpieza de notificaciones',
    descripcion: 'Borra notificaciones leídas con más de 90 días.',
    horario: 'Lunes 3:00 a.m.',
  },
  siigo_sync_oc: {
    nombre: 'Sincronización Siigo (OC)',
    descripcion: 'Envía órdenes de compra aprobadas a Siigo.',
    horario: 'Al aprobar / reintento automático',
  },
  siigo_sync_catalogo: {
    nombre: 'Catálogo Siigo',
    descripcion: 'Baja lo nuevo de Siigo (productos y proveedores) y lo compara con el panel para validar.',
    horario: 'Diario 12:00 a.m.',
  },
  enviar_correos: {
    nombre: 'Cola de correos',
    descripcion: 'Procesa y envía la cola de correos pendientes.',
    horario: 'Cada minuto',
  },
  reporte_semanal: {
    nombre: 'Reporte semanal',
    descripcion: 'Genera y envía el resumen semanal a supervisor.',
    horario: 'Lunes 7:00 a.m.',
  },
}

interface FilaLogAutomatizacion {
  regla: string
  inicio: string
  fin: string | null
  resultado: 'en_curso' | 'ok' | 'error'
  filas_afectadas: number | null
  error: string | null
  duracion_segundos: number | null
}

export async function fetchAutomatizaciones(): Promise<AutomatizacionEstado[]> {
  if (isDevBypassActive()) return PREVIEW_AUTOMATIZACIONES

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vista_log_automatizaciones_ultimo_estado')
    .select('regla, inicio, fin, resultado, filas_afectadas, error, duracion_segundos')

  if (error) throw new Error(`No se pudo cargar el estado de automatizaciones: ${error.message}`)

  return ((data ?? []) as FilaLogAutomatizacion[]).map((fila) => {
    const etiqueta = ETIQUETAS_REGLA[fila.regla]
    return {
      id: fila.regla,
      nombre: etiqueta?.nombre ?? fila.regla,
      descripcion: etiqueta?.descripcion ?? '',
      horario: etiqueta?.horario ?? '—',
      ultimaEjecucion: fila.fin ?? fila.inicio,
      resultado: fila.resultado,
      error: fila.error,
    }
  })
}
