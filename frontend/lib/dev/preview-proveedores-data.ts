import type { Proveedor, ProveedorFila } from '@/lib/types/proveedor'

const FECHA = '2026-01-15T12:00:00.000Z'

function proveedor(
  id: number,
  nit: string,
  nombre: string,
  extra: Partial<Proveedor> = {}
): Proveedor {
  return {
    id,
    nit,
    nit_normalizado: nit.replace(/\D/g, ''),
    nombre,
    email: null,
    telefono: null,
    contacto: null,
    notas: null,
    activo: true,
    origen: 'oc',
    created_at: FECHA,
    updated_at: FECHA,
    ...extra,
  }
}

export function getDevPreviewProveedores(): ProveedorFila[] {
  return [
    {
      ...proveedor(1, '890.903.938-8', 'AIRGAS DE COLOMBIA S.A.S.', {
        email: 'ventas@airgas.example.com',
        telefono: '604 444 1200',
        contacto: 'Marcela Ríos',
        origen: 'siigo',
      }),
      total_ordenes: 12,
      ordenes_puntuadas: 11,
      porcentaje_promedio: 96.4,
      ultima_reevaluacion: { anio: 2025, resultado: 'continuar', porcentaje: 94.2 },
    },
    {
      ...proveedor(2, '811.026.743-1', 'ALFIBRAS S.A.S.', {
        email: 'pedidos@alfibras.example.com',
        contacto: 'Jorge Patiño',
        origen: 'siigo',
      }),
      total_ordenes: 8,
      ordenes_puntuadas: 8,
      porcentaje_promedio: 88.1,
      ultima_reevaluacion: { anio: 2025, resultado: 'continuar', porcentaje: 87.5 },
    },
    {
      ...proveedor(3, '900.412.557-3', 'ACCESORIOS TÉCNICOS LTA', {
        email: 'comercial@accesoriostecnicos.example.com',
      }),
      total_ordenes: 5,
      ordenes_puntuadas: 4,
      porcentaje_promedio: 71.3,
      ultima_reevaluacion: { anio: 2025, resultado: 'no_continuar', porcentaje: 68 },
    },
    {
      ...proveedor(4, '860.512.390-6', 'INDUSTRIAL GRÁFICA LTDA', { origen: 'manual' }),
      total_ordenes: 3,
      ordenes_puntuadas: 2,
      porcentaje_promedio: 82.5,
      ultima_reevaluacion: null,
    },
    {
      ...proveedor(5, '901.234.876-0', 'ACEROS DEL VALLE S.A.', {
        telefono: '602 331 4455',
        origen: 'importado',
      }),
      total_ordenes: 0,
      ordenes_puntuadas: 0,
      porcentaje_promedio: null,
      ultima_reevaluacion: null,
    },
    {
      ...proveedor(6, '830.087.221-9', 'PINTURAS Y RECUBRIMIENTOS DE COLOMBIA S.A.S.', {
        email: 'ventas@pinturasrc.example.com',
        contacto: 'Andrea Gómez',
        origen: 'siigo',
      }),
      total_ordenes: 6,
      ordenes_puntuadas: 6,
      porcentaje_promedio: 93.8,
      ultima_reevaluacion: null,
    },
    {
      ...proveedor(7, '800.145.620-2', 'SUMINISTROS INDUSTRIALES LTDA', {
        activo: false,
        notas: 'Proveedor inactivo en Siigo.',
      }),
      total_ordenes: 1,
      ordenes_puntuadas: 1,
      porcentaje_promedio: 55,
      ultima_reevaluacion: null,
    },
    {
      ...proveedor(8, '901.998.114-5', 'TORNILLERÍA ANDINA LTDA', { origen: 'manual' }),
      total_ordenes: 2,
      ordenes_puntuadas: 0,
      porcentaje_promedio: null,
      ultima_reevaluacion: null,
    },
  ]
}
