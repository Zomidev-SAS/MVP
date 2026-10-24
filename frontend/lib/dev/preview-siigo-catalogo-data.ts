import type { SiigoCatalogoEstado } from '@/lib/types/siigo'

export const PREVIEW_SIIGO_CATALOGO: SiigoCatalogoEstado = {
  diferencias: [
    {
      id: 1,
      tipo: 'producto',
      codigo: 'PROD-001',
      campo: 'nombre',
      valorPanel: 'Filtro de aceite 1.6',
      valorSiigo: 'Filtro de aceite 1.6L',
      creadoEn: new Date().toISOString(),
    },
    {
      id: 2,
      tipo: 'proveedor',
      codigo: '900123456',
      campo: 'nombre',
      valorPanel: 'COAUTOPARTES SAS',
      valorSiigo: 'COAUTOPARTES S.A.S.',
      creadoEn: new Date().toISOString(),
    },
  ],
  ultimaSincronizacion: {
    fecha: new Date().toISOString(),
    resultado: 'ok',
    error: null,
  },
}
