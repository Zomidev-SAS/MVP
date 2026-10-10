import type { AutomatizacionEstado } from '@/lib/types/automatizaciones'

export const PREVIEW_AUTOMATIZACIONES: AutomatizacionEstado[] = [
  { id: 'stock_bajo', nombre: 'Stock bajo', descripcion: 'Revisa productos bajo el umbral y genera alerta.', horario: 'Cada 15 minutos', ultimaEjecucion: new Date().toISOString(), resultado: 'ok', error: null },
  { id: 'recordatorios', nombre: 'Recordatorios', descripcion: 'Envía recordatorios de tareas pendientes por rol.', horario: 'Diario 7:00 a.m.', ultimaEjecucion: new Date().toISOString(), resultado: 'ok', error: null },
  { id: 'oc_vencidas', nombre: 'OC vencidas', descripcion: 'Marca y notifica órdenes de compra vencidas.', horario: 'Diario 6:00 a.m.', ultimaEjecucion: new Date().toISOString(), resultado: 'parcial', error: '2 de 14 OC no se pudieron evaluar (proveedor sin fecha límite).' },
  { id: 'cierre_diario', nombre: 'Cierre diario', descripcion: 'Consolida movimientos y genera reporte del día.', horario: 'Diario 11:59 p.m.', ultimaEjecucion: new Date(Date.now() - 86_400_000).toISOString(), resultado: 'ok', error: null },
  { id: 'reintentos_vin', nombre: 'Reintentos VIN', descripcion: 'Reintenta consultas de saldo VIN fallidas.', horario: 'Cada hora', ultimaEjecucion: new Date().toISOString(), resultado: 'error', error: 'Timeout consultando servicio externo de VIN.' },
  { id: 'sincronizacion_siigo', nombre: 'Sincronización Siigo', descripcion: 'Reintenta OC pendientes de enviar a Siigo.', horario: 'Cada 10 minutos', ultimaEjecucion: new Date().toISOString(), resultado: 'ok', error: null },
  { id: 'cola_correos', nombre: 'Cola de correos', descripcion: 'Procesa y reintenta el envío de correos pendientes.', horario: 'Cada 5 minutos', ultimaEjecucion: new Date().toISOString(), resultado: 'ok', error: null },
  { id: 'reporte_semanal', nombre: 'Reporte semanal', descripcion: 'Genera y envía el resumen semanal a supervisor.', horario: 'Lunes 6:00 a.m.', ultimaEjecucion: new Date(Date.now() - 4 * 86_400_000).toISOString(), resultado: 'sin_ejecutar', error: null },
]
