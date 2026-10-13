'use server'

import { SignJWT, jwtVerify } from 'jose'
import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { PREVIEW_DASHBOARD_GRAFICAS } from '@/lib/dev/preview-dashboard-graficas-data'
import { fetchProductosBajoStock } from '@/lib/supabase/inventario-actions'
import type { ProductoBajoStock } from '@/components/dashboard/LowStockList'
import type { VehiculoPorEtapaPunto } from '@/lib/types/dashboard-graficas'
import type { EntradaSalidaDia } from '@/lib/types/dashboard'

// El secreto de firma es el ÚNICO control de acceso de /planta/* (no hay
// sesión, no hay chequeo de rol a nivel de ruta). El fallback de desarrollo
// está committeado en el repo, así que NUNCA debe usarse en producción:
// si PLANTA_KIOSK_SECRET no está configurado ahí, se falla cerrado
// (generarTokenPlanta lanza, verificarTokenPlanta rechaza todo) en vez de
// firmar/verificar silenciosamente contra un secreto público conocido.
const DEV_FALLBACK_SECRET = 'dev-secret-cambiar-en-produccion'
const SECRET_ENV = process.env.PLANTA_KIOSK_SECRET

function getSecretParaFirmar(): Uint8Array {
  if (process.env.NODE_ENV === 'production' && !SECRET_ENV) {
    throw new Error('PLANTA_KIOSK_SECRET no está configurado en producción.')
  }
  return new TextEncoder().encode(SECRET_ENV ?? DEV_FALLBACK_SECRET)
}

function getSecretParaVerificar(): Uint8Array | null {
  if (process.env.NODE_ENV === 'production' && !SECRET_ENV) {
    return null
  }
  return new TextEncoder().encode(SECRET_ENV ?? DEV_FALLBACK_SECRET)
}

export interface DatosPlanta {
  vehiculosPorEtapa: VehiculoPorEtapaPunto[]
  entradasSalidas: EntradaSalidaDia[]
  productosStockBajo: ProductoBajoStock[]
}

export async function generarTokenPlanta(): Promise<string> {
  const auth = await requireRole(['supervisor'])
  if (!auth.ok) throw new Error(auth.error)
  const secret = getSecretParaFirmar()
  return new SignJWT({ tipo: 'planta-kiosk' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret)
}

export async function verificarTokenPlanta(token: string): Promise<boolean> {
  // La TV del taller corre con DEV_SKIP_AUTH en entornos de desarrollo/demo
  // sin que exista un flujo para generar un JWT firmado real ahí — igual
  // patrón que el resto del código: isDevBypassActive() evita exigir
  // credenciales reales mientras se prueba localmente.
  if (isDevBypassActive()) return true

  const secret = getSecretParaVerificar()
  // Producción sin PLANTA_KIOSK_SECRET configurado: no hay secreto real
  // contra el que verificar, así que ningún token puede considerarse
  // válido (fallar cerrado, nunca caer al secreto de desarrollo conocido).
  if (!secret) return false

  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    // Rechaza tokens que verifican correctamente pero no fueron emitidos
    // por generarTokenPlanta (ej. otro JWT firmado con la misma variable
    // de entorno reutilizada en otra parte del sistema).
    return payload.tipo === 'planta-kiosk'
  } catch {
    return false
  }
}

interface RespuestaRpcDatosPlanta {
  vehiculos_por_etapa: { etapa: string; cantidad: number }[]
  entradas_salidas: EntradaSalidaDia[]
  productos_stock_bajo: ProductoBajoStock[]
}

const DATOS_PLANTA_VACIOS: DatosPlanta = { vehiculosPorEtapa: [], entradasSalidas: [], productosStockBajo: [] }

/**
 * Datos para el modo pantalla de planta (`/planta/[token]`), una ruta SIN
 * sesión de usuario autenticado (una TV del taller, gateada solo por el
 * token firmado anterior). Por eso no reutiliza `fetchDashboardGraficas`
 * ni `requireRole`/`getCurrentProfile`.
 *
 * Lee de `rpc_datos_planta(p_token)` (migración 048) con el cliente anon.
 * Ese RPC vuelve a verificar la firma del token en la base contra el
 * secreto 'PLANTA_KIOSK_SECRET' del Vault, así que la anon key pública sola
 * no basta para leer estos datos. Solo devuelve datos sin dinero; NUNCA se
 * debe dar acceso `anon` a `rpc_kpis_dashboard()` ni a las vistas de B6.
 *
 * El token también se verifica aquí antes de llamar a Supabase, para no
 * depender de que quien importe esta función lo haya hecho antes.
 */
export async function fetchDatosPlanta(token: string): Promise<DatosPlanta> {
  const valido = await verificarTokenPlanta(token)
  if (!valido) return DATOS_PLANTA_VACIOS

  if (isDevBypassActive()) {
    return {
      vehiculosPorEtapa: PREVIEW_DASHBOARD_GRAFICAS.vehiculosPorEtapa,
      entradasSalidas: PREVIEW_DASHBOARD_GRAFICAS.entradasSalidas,
      productosStockBajo: await fetchProductosBajoStock(5),
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('rpc_datos_planta', { p_token: token })

  if (error || !data) {
    // Lo más común: PLANTA_KIOSK_SECRET del VPS no coincide con el del Vault.
    console.error('Failed to load rpc_datos_planta:', error)
    return DATOS_PLANTA_VACIOS
  }

  const respuesta = data as RespuestaRpcDatosPlanta
  return {
    // vehiculo_procesos no registra cuánto dura cada etapa todavía.
    vehiculosPorEtapa: (respuesta.vehiculos_por_etapa ?? []).map((v) => ({
      etapa: v.etapa,
      cantidad: Number(v.cantidad),
      tiempoPromedioDias: 0,
    })),
    entradasSalidas: (respuesta.entradas_salidas ?? []).map((d) => ({
      fecha: d.fecha,
      entradas: Number(d.entradas),
      salidas: Number(d.salidas),
    })),
    productosStockBajo: (respuesta.productos_stock_bajo ?? []).map((p) => ({
      codigo_producto: p.codigo_producto,
      nombre_producto: p.nombre_producto,
      saldo: Number(p.saldo),
    })),
  }
}
