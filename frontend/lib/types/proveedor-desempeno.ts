import { z } from 'zod'
import { CALIDADES, type Calidad, type ConfigDesempeno } from '@/lib/proveedores/desempeno'

const fechaOVacia = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'), z.literal('')])

/** Lo que se captura a mano en el desempeño de una OC. Vacío = se usa lo que dice la OC. */
export const guardarDesempenoSchema = z.object({
  calidad: z.enum(CALIDADES).nullable(),
  calidad_comentario: z.string().trim(),
  devoluciones: z
    .number({ message: 'Escribe un número' })
    .int('Debe ser un número entero')
    .min(0, 'No puede ser negativo'),
  devoluciones_detalle: z.string().trim(),
  cantidad_observaciones: z.string().trim(),
  pagos_acordados: z.string().trim(),
  tiempo_observaciones: z.string().trim(),
  observaciones: z.string().trim(),
  fecha_entrega_prometida: fechaOVacia,
  fecha_entrega_real: fechaOVacia,
  factura_remision: z.string().trim(),
})

export type GuardarDesempenoInput = z.infer<typeof guardarDesempenoSchema>

export type DesempenoResultado = { ok: true } | { ok: false; error: string }

/** Una fila de proveedor_desempeno tal como llega de la base. */
export interface DesempenoRegistro {
  id: number
  proveedor_id: number
  orden_id: number | null
  numero_oc: string | null
  fecha_oc: string | null
  fecha_entrega_prometida: string | null
  fecha_entrega_real: string | null
  factura_remision: string | null
  cantidad_pedida: number | null
  cantidad_recibida: number | null
  calidad: Calidad | null
  calidad_comentario: string | null
  devoluciones: number
  devoluciones_detalle: string | null
  cantidad_observaciones: string | null
  pagos_acordados: string | null
  tiempo_observaciones: string | null
  observaciones: string | null
  actualizado_por_nombre: string | null
  updated_at: string | null
}

export const configDesempenoSchema = z
  .object({
    umbral: z.number().min(0, 'Entre 0 y 100').max(100, 'Entre 0 y 100'),
    pesos: z.object({
      calidad: z.number().int().min(0).max(100),
      devoluciones: z.number().int().min(0).max(100),
      cantidad: z.number().int().min(0).max(100),
      tiempo: z.number().int().min(0).max(100),
    }),
    penalizacionDia: z.number().min(0, 'No puede ser negativa'),
    penalizacionDevolucion: z.number().min(0, 'No puede ser negativa'),
  })
  .refine(
    (c) => c.pesos.calidad + c.pesos.devoluciones + c.pesos.cantidad + c.pesos.tiempo > 0,
    { message: 'Al menos una división debe tener peso', path: ['pesos'] }
  )

export type ConfigDesempenoInput = ConfigDesempeno

const fechaONula = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()

/** Una fila ya leída del cuadro de control (Excel/CSV) para guardar como historial. */
export const filaHistorialImportadaSchema = z.object({
  numero_oc: z.string().trim().min(1).max(60),
  fecha_oc: fechaONula,
  fecha_entrega_prometida: fechaONula,
  fecha_entrega_real: fechaONula,
  devoluciones: z.number().int().min(0),
  observaciones: z.string().trim().max(2000).nullable(),
  factura_remision: z.string().trim().max(120).nullable(),
})

export type ImportarHistorialResultado =
  | { ok: true; creados: number; actualizados: number; vinculados: number }
  | { ok: false; error: string }
