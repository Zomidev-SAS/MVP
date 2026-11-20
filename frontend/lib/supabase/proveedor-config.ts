import { CONFIG_DESEMPENO_DEFAULT, type ConfigDesempeno } from '@/lib/proveedores/desempeno'
import type { createClient } from '@/lib/supabase/server'

type Cliente = Awaited<ReturnType<typeof createClient>>

const COLUMNAS_CONFIG =
  'proveedor_umbral_aprobacion, proveedor_peso_calidad, proveedor_peso_devoluciones, proveedor_peso_cantidad, proveedor_peso_tiempo, proveedor_penalizacion_dia, proveedor_penalizacion_devolucion'

interface FilaConfig {
  proveedor_umbral_aprobacion: number
  proveedor_peso_calidad: number
  proveedor_peso_devoluciones: number
  proveedor_peso_cantidad: number
  proveedor_peso_tiempo: number
  proveedor_penalizacion_dia: number
  proveedor_penalizacion_devolucion: number
}

/** Parámetros de evaluación de config_app; los valores por defecto si la migración 081 no está. */
export async function leerConfigDesempeno(supabase: Cliente): Promise<ConfigDesempeno> {
  const { data, error } = await supabase
    .from('config_app')
    .select(COLUMNAS_CONFIG)
    .eq('id', 1)
    .maybeSingle()

  if (error || !data) {
    if (error && error.code !== '42703') console.error('Failed to load proveedor config:', error)
    return CONFIG_DESEMPENO_DEFAULT
  }

  const fila = data as unknown as FilaConfig
  return {
    umbral: Number(fila.proveedor_umbral_aprobacion),
    pesos: {
      calidad: Number(fila.proveedor_peso_calidad),
      devoluciones: Number(fila.proveedor_peso_devoluciones),
      cantidad: Number(fila.proveedor_peso_cantidad),
      tiempo: Number(fila.proveedor_peso_tiempo),
    },
    penalizacionDia: Number(fila.proveedor_penalizacion_dia),
    penalizacionDevolucion: Number(fila.proveedor_penalizacion_devolucion),
  }
}

export function configAColumnas(config: ConfigDesempeno): FilaConfig {
  return {
    proveedor_umbral_aprobacion: Math.round(config.umbral),
    proveedor_peso_calidad: config.pesos.calidad,
    proveedor_peso_devoluciones: config.pesos.devoluciones,
    proveedor_peso_cantidad: config.pesos.cantidad,
    proveedor_peso_tiempo: config.pesos.tiempo,
    proveedor_penalizacion_dia: config.penalizacionDia,
    proveedor_penalizacion_devolucion: config.penalizacionDevolucion,
  }
}
