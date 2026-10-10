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

const SECRET = new TextEncoder().encode(
  process.env.PLANTA_KIOSK_SECRET ?? 'dev-secret-cambiar-en-produccion'
)

export interface DatosPlanta {
  vehiculosPorEtapa: VehiculoPorEtapaPunto[]
  entradasSalidas: EntradaSalidaDia[]
  productosStockBajo: ProductoBajoStock[]
}

export async function generarTokenPlanta(): Promise<string> {
  const auth = await requireRole(['supervisor'])
  if (!auth.ok) throw new Error(auth.error)
  return new SignJWT({ tipo: 'planta-kiosk' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SECRET)
}

export async function verificarTokenPlanta(token: string): Promise<boolean> {
  // La TV del taller corre con DEV_SKIP_AUTH en entornos de desarrollo/demo
  // sin que exista un flujo para generar un JWT firmado real ahí — igual
  // patrón que el resto del código: isDevBypassActive() evita exigir
  // credenciales reales mientras se prueba localmente.
  if (isDevBypassActive()) return true

  try {
    await jwtVerify(token, SECRET)
    return true
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
 * NOTA PARA BACKEND: en producción esta función usa el cliente anon de
 * Supabase (sin sesión) para llamar el mismo RPC `dashboard_graficas` que
 * ya es un placeholder pendiente de contrato (ver dashboard-graficas-actions.ts).
 * Si las políticas RLS reales de las vistas/tablas subyacentes solo
 * permiten lectura a `authenticated` (varios comentarios en roles.ts
 * sugieren que es el caso, ej. "mov_select_autenticados"), esta llamada
 * anónima devolverá error o cero filas en producción real. Este fallback
 * está escrito para degradar con listas vacías en ese caso (no truena la
 * página), pero probablemente backend necesite exponer una vista/RPC
 * específica para el kiosk con permiso de lectura `anon`, o el equipo debe
 * decidir conscientemente dar ese permiso a las vistas actuales.
 */
export async function fetchDatosPlanta(): Promise<DatosPlanta> {
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
