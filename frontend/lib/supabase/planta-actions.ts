'use server'

import { SignJWT, jwtVerify } from 'jose'
import { requireRole } from '@/lib/auth/require-role'
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

/**
 * Datos para el modo pantalla de planta (`/planta/[token]`), una ruta SIN
 * sesión de usuario autenticado (una TV del taller, gateada solo por el
 * token firmado anterior). Por eso esta función no puede reutilizar
 * `fetchDashboardGraficas` (que desde la corrección de la tarea 2.1 exige
 * una sesión real vía `getCurrentProfile()` para decidir el acceso a
 * costos) ni llamar `requireRole`/`getCurrentProfile` en absoluto.
 *
 * Nunca se piden ni se devuelven datos de costos/valorización aquí.
 *
 * NOTA PARA BACKEND — IMPORTANTE, leer antes de tocar permisos de Supabase:
 * a la fecha (ver docs/CONTRATO_DATOS_SECCION2.md, sección 10) NO existe
 * ninguna vista/RPC con permiso de lectura para el rol `anon`. Las vistas
 * de B6 (`vista_vehiculos_por_etapa`, etc.) solo tienen
 * `grant select ... to authenticated` — un cliente anon las recibe
 * rechazadas por RLS/falta de grant, tal como debe ser.
 *
 * NUNCA se debe otorgar al rol `anon` permiso de lectura sobre
 * `rpc_kpis_dashboard()`, las vistas de B6, ni ninguna otra vista/RPC que
 * incluya datos monetarios — `anon` significa literalmente cualquiera con
 * la anon key pública, no solo esta pantalla del taller; hacerlo filtraría
 * costos a cualquier visitante no autenticado, no solo a este kiosk.
 *
 * La única solución aceptable del lado de backend es un RPC/vista
 * DEDICADO y específico para este kiosk, que devuelva ÚNICAMENTE
 * `vehiculosPorEtapa`/`entradasSalidas` (sin ningún campo monetario), y
 * que ese RPC/vista dedicado sea el que obtenga permiso de lectura `anon`
 * — nunca el RPC/vistas que ya exponen costos a otros roles.
 *
 * Mientras ese RPC/vista dedicado no exista, esta función no intenta
 * llamar nada contra Supabase (no hay nada seguro que llamar todavía) y
 * se degrada directo a listas vacías, en vez de tronar la pantalla del
 * taller o arriesgar un error que exponga más de lo debido.
 *
 * El token gatea el acceso a esta página y a esta función, pero una vez que
 * el backend exponga una vista/RPC legible por `anon` para el kiosco,
 * cualquier persona con la clave anon pública podría leer esos datos
 * directamente sin pasar por este token — el token protege el acceso vía
 * esta página/función, no los datos en la base si el backend los expone a
 * `anon` de forma más amplia. Por eso esta función NO confía en que quien la
 * llama ya verificó el token (aunque hoy solo la importe el Server
 * Component de `/planta/[token]`, que sí lo hace): recibe el token como
 * parámetro y lo vuelve a verificar aquí mismo, en vez de asumirlo — así
 * sigue siendo segura aunque en el futuro alguien la importe desde otro
 * lugar (ej. un Client Component) sin pasar primero por esa verificación.
 */
export async function fetchDatosPlanta(token: string): Promise<DatosPlanta> {
  const valido = await verificarTokenPlanta(token)
  if (!valido) {
    return { vehiculosPorEtapa: [], entradasSalidas: [], productosStockBajo: [] }
  }

  if (isDevBypassActive()) {
    return {
      vehiculosPorEtapa: PREVIEW_DASHBOARD_GRAFICAS.vehiculosPorEtapa,
      entradasSalidas: PREVIEW_DASHBOARD_GRAFICAS.entradasSalidas,
      productosStockBajo: await fetchProductosBajoStock(5),
    }
  }

  // Ningún RPC/vista anon-safe existe todavía (ver nota arriba) — se
  // degrada directo a listas vacías en vez de llamar algo que expondría
  // costos a `anon` o que simplemente no tiene permiso para leer nada.
  const vehiculosPorEtapa: VehiculoPorEtapaPunto[] = []
  const entradasSalidas: EntradaSalidaDia[] = []

  const productosStockBajo = await fetchProductosBajoStock(5)

  return { vehiculosPorEtapa, entradasSalidas, productosStockBajo }
}
