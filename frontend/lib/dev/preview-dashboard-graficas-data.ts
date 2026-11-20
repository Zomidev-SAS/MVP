// frontend/lib/dev/preview-dashboard-graficas-data.ts
import type { DashboardGraficasPayload } from '@/lib/types/dashboard-graficas'

export const PREVIEW_DASHBOARD_GRAFICAS: DashboardGraficasPayload = {
  kpis: [
    { id: 'stock_total', etiqueta: 'Stock total', valor: 4820, unidad: 'unidades', variacionPct: 3.2 },
    { id: 'oc_abiertas', etiqueta: 'OC abiertas', valor: 12, unidad: 'unidades', variacionPct: -8.1 },
    { id: 'tiempo_promedio_etapa', etiqueta: 'Tiempo promedio por etapa', valor: 4.3, unidad: 'dias', variacionPct: -5.0 },
  ],
  entradasSalidas: Array.from({ length: 7 }).map((_, i) => ({
    fecha: new Date(Date.now() - (6 - i) * 86_400_000).toISOString().slice(0, 10),
    entradas: 20 + i * 3,
    salidas: 15 + i * 2,
  })),
  stockPorBodega: [
    { bodega: 'Principal', cantidad: 2100 },
    { bodega: 'Taller', cantidad: 1400 },
    { bodega: 'Instalación', cantidad: 1320 },
  ],
  stockPorCategoria: [
    { categoria: 'Carrocería', cantidad: 1800 },
    { categoria: 'Mecánica', cantidad: 1500 },
    { categoria: 'Accesorios', cantidad: 1520 },
  ],
  topProductos: Array.from({ length: 10 }).map((_, i) => ({
    producto: `Producto ${i + 1}`,
    cantidad: 300 - i * 20,
  })),
  vehiculosPorEtapa: [
    { etapa: 'Recepción', cantidad: 5, tiempoPromedioDias: 1.2 },
    { etapa: 'Metalmecánica', cantidad: 8, tiempoPromedioDias: 3.5 },
    { etapa: 'Instalación', cantidad: 6, tiempoPromedioDias: 2.8 },
    { etapa: 'Entrega', cantidad: 3, tiempoPromedioDias: 0.6 },
  ],
  ajustesOCPorEstado: [
    { tipo: 'ajuste', estado: 'pendiente', cantidad: 4 },
    { tipo: 'ajuste', estado: 'aprobado', cantidad: 22 },
    { tipo: 'orden_compra', estado: 'en_curso', cantidad: 12 },
    { tipo: 'orden_compra', estado: 'listo', cantidad: 30 },
  ],
  valorizacion: Array.from({ length: 7 }).map((_, i) => ({
    fecha: new Date(Date.now() - (6 - i) * 86_400_000).toISOString().slice(0, 10),
    valorCop: 85_000_000 + i * 1_200_000,
  })),
}
