import type { OrdenParaHistorial } from '@/lib/proveedores/historial'
import type { DesempenoRegistro } from '@/lib/types/proveedor-desempeno'
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

function orden(
  id: number,
  numeroOc: string,
  fechaOc: string,
  prometida: string,
  real: string | null,
  factura: string | null,
  extra: Partial<OrdenParaHistorial> = {}
): OrdenParaHistorial {
  const [prefijo, numero] = factura ? factura.split('-') : [null, null]
  return {
    id,
    numero_oc: numeroOc,
    fecha_pedido: fechaOc,
    fecha_vencimiento: prometida,
    fecha_cierre: real,
    finalizada_at: real ? `${real}T17:00:00.000Z` : null,
    estado: 'listo',
    factura_proveedor_prefijo: prefijo,
    factura_proveedor_numero: numero,
    items: [{ cantidad: 20, cantidad_recibida: 20 }],
    recepciones: [],
    ...extra,
  }
}

function registro(
  id: number,
  ordenId: number | null,
  extra: Partial<DesempenoRegistro> = {}
): DesempenoRegistro {
  return {
    id,
    proveedor_id: 2,
    orden_id: ordenId,
    numero_oc: null,
    fecha_oc: null,
    fecha_entrega_prometida: null,
    fecha_entrega_real: null,
    factura_remision: null,
    cantidad_pedida: null,
    cantidad_recibida: null,
    calidad: null,
    calidad_comentario: null,
    devoluciones: 0,
    devoluciones_detalle: null,
    cantidad_observaciones: null,
    pagos_acordados: null,
    tiempo_observaciones: null,
    observaciones: null,
    actualizado_por_nombre: 'Vista Previa Dev',
    updated_at: '2025-08-20T15:30:00.000Z',
    ...extra,
  }
}

/** Historial de ejemplo con el aspecto del cuadro de control de entregas de compras. */
export function getDevPreviewHistorial(): {
  ordenes: OrdenParaHistorial[]
  registros: DesempenoRegistro[]
} {
  return {
    ordenes: [
      orden(3190, 'OC-1-3190', '2026-11-10', '2026-11-24', null, null, {
        estado: 'en_curso',
        fecha_cierre: null,
        finalizada_at: null,
        items: [{ cantidad: 40, cantidad_recibida: 12 }],
      }),
      orden(2868, 'OC-1-2868', '2025-08-18', '2025-08-19', '2025-08-19', 'FC-39982'),
      orden(2815, 'OC-1-2815', '2025-08-11', '2025-08-12', '2025-08-12', 'FC-39746'),
      orden(2798, 'OC-1-2798', '2025-08-04', '2025-08-05', '2025-08-08', 'FC-39529', {
        items: [{ cantidad: 20, cantidad_recibida: 18 }],
      }),
      orden(2761, 'OC-1-2761', '2025-07-21', '2025-07-22', '2025-07-22', 'FC-39119'),
      orden(2745, 'OC-1-2745', '2025-07-14', '2025-07-15', '2025-07-15', 'FC-38873'),
      orden(2737, 'OC-1-2737', '2025-07-07', '2025-08-22', '2025-07-08', 'FC-38723'),
    ],
    registros: [
      registro(1, 2868, { calidad: 'bien' }),
      registro(2, 2815, { calidad: 'bien' }),
      registro(3, 2798, {
        calidad: 'regular',
        calidad_comentario: 'Dos rollos con la fibra húmeda.',
        devoluciones: 2,
        devoluciones_detalle: 'Se devolvieron los dos rollos húmedos.',
        tiempo_observaciones: 'Retraso en la transportadora.',
        pagos_acordados: '2 pagos',
      }),
      registro(4, 2761, { calidad: 'bien' }),
      registro(5, null, {
        numero_oc: 'OC-1-2690',
        fecha_oc: '2025-06-16',
        fecha_entrega_prometida: '2025-06-20',
        fecha_entrega_real: '2025-06-24',
        factura_remision: 'FC-37810',
        devoluciones: 1,
        observaciones: 'Importada del cuadro de control de junio.',
      }),
    ],
  }
}
