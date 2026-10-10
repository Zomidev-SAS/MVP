'use server'

import { SignJWT, jwtVerify } from 'jose'
import { createClient } from '@/lib/supabase/server'
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
 * en producción esta función usa el cliente anon de Supabase (sin sesión)
 * para llamar el mismo RPC `dashboard_graficas` que ya es un placeholder
 * pendiente de contrato (ver dashboard-graficas-actions.ts). Ese RPC (y las
 * vistas de las que lee) devuelve `valorización`/costos para otros
 * consumidores autenticados.
 *
 * NUNCA se debe otorgar al rol `anon` permiso de lectura sobre
 * `dashboard_graficas` ni sobre ninguna vista/RPC que incluya datos
 * monetarios — `anon` significa literalmente cualquiera con la anon key
 * pública, no solo esta pantalla del taller; hacerlo filtraría costos a
 * cualquier visitante no autenticado, no solo a este kiosk.
 *
 * La única solución aceptable del lado de backend es un RPC/vista
 * DEDICADO y específico para este kiosk, que devuelva ÚNICAMENTE
 * `vehiculosPorEtapa`/`entradasSalidas` (sin ningún campo monetario), y
 * que ese RPC/vista dedicado sea el que obtenga permiso de lectura `anon`
 * — nunca el RPC/vistas que ya exponen costos a otros roles.
 *
 * Mientras ese RPC dedicado no exista, esta función se degrada a listas
 * vacías si la llamada falla (RPC inexistente o RLS la rechaza), en vez de
 * tronar la pantalla del taller.
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

  let vehiculosPorEtapa: VehiculoPorEtapaPunto[] = []
  let entradasSalidas: EntradaSalidaDia[] = []

  try {
    const supabase = await createClient()
    // Mismo RPC placeholder que fetchDashboardGraficas (pendiente de
    // confirmar con el contrato de datos de backend) — aquí se llama sin
    // sesión y solo se toman los dos campos sin costos del payload.
    const { data, error } = await supabase.rpc('dashboard_graficas', {
      p_rango: '7d',
      p_desde: null,
      p_hasta: null,
      p_bodega_id: null,
      p_categoria_id: null,
    })

    if (!error && data) {
      const payload = data as {
        vehiculosPorEtapa?: VehiculoPorEtapaPunto[]
        entradasSalidas?: EntradaSalidaDia[]
      }
      vehiculosPorEtapa = payload.vehiculosPorEtapa ?? []
      entradasSalidas = payload.entradasSalidas ?? []
    }
  } catch {
    // RPC aún no existe o RLS bloquea la lectura anónima — ver nota arriba.
    // Se degrada a listas vacías en vez de tronar la pantalla del taller.
  }

  const productosStockBajo = await fetchProductosBajoStock(5)

  return { vehiculosPorEtapa, entradasSalidas, productosStockBajo }
}
