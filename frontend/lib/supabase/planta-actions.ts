'use server'

import { SignJWT, jwtVerify } from 'jose'
import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { PREVIEW_DASHBOARD_GRAFICAS } from '@/lib/dev/preview-dashboard-graficas-data'
import { fetchProductosBajoStock } from '@/lib/supabase/inventario-actions'
import type { ProductoBajoStock } from '@/components/dashboard/LowStockList'
import type { VehiculoPorEtapaPunto } from '@/lib/types/dashboard-graficas'
import type { DatosPlantaCompras } from '@/lib/types/planta-compras'
import type { EntradaSalidaDia } from '@/lib/types/dashboard'
import { getDevPreviewFormulariosData } from '@/lib/dev/preview-formularios-data'
import { getDevPreviewProcesosVehiculo } from '@/lib/dev/preview-procesos-vehiculo-data'
import { normalizarFormularios } from '@/lib/formularios/normalize'
import { normalizarTextoBusqueda } from '@/lib/formularios/busqueda'
import { vistaFormulario, type FormularioListado } from '@/lib/types/formularios'
import type { VehiculoProceso } from '@/lib/types/vehiculo-proceso'
import {
  construirEventosLineaTiempo,
  extraerSugerenciasVehiculo,
  listarVehiculosRecientes,
  type EventoLineaTiempo,
  type VehiculoSugerencia,
} from '@/lib/formularios/linea-tiempo'

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

const TIPO_PLANTA_GENERAL = 'planta-kiosk'
const TIPO_PLANTA_COMPRAS = 'planta-compras'

async function firmarTokenPlanta(tipo: string): Promise<string> {
  const secret = getSecretParaFirmar()
  return new SignJWT({ tipo })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret)
}

export async function generarTokenPlanta(): Promise<string> {
  const auth = await requireRole(['supervisor'])
  if (!auth.ok) throw new Error(auth.error)
  return firmarTokenPlanta(TIPO_PLANTA_GENERAL)
}

/** Enlace de la TV de compras: lo pueden generar compras y supervisor. */
export async function generarTokenPlantaCompras(): Promise<string> {
  const auth = await requireRole(['supervisor', 'compras'])
  if (!auth.ok) throw new Error(auth.error)
  return firmarTokenPlanta(TIPO_PLANTA_COMPRAS)
}

export async function verificarTokenPlanta(
  token: string,
  tipo: string = TIPO_PLANTA_GENERAL
): Promise<boolean> {
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
    // de entorno reutilizada en otra parte del sistema) o que son de otra
    // pantalla: un token de la TV del taller no abre la de compras.
    return payload.tipo === tipo
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

// ── Vehículos (vista "Vehículos por etapa" de la TV, solo lectura) ──────────

async function cargarFormulariosPlanta(token: string): Promise<FormularioListado[]> {
  if (!(await verificarTokenPlanta(token))) return []
  if (isDevBypassActive()) return getDevPreviewFormulariosData()

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('rpc_planta_formularios', { p_token: token })
  if (error || !Array.isArray(data)) {
    console.error('Failed to load rpc_planta_formularios:', error)
    return []
  }
  return normalizarFormularios(data)
}

export async function fetchVehiculosRecientesPlanta(
  token: string,
  limite = 40
): Promise<VehiculoSugerencia[]> {
  return listarVehiculosRecientes(await cargarFormulariosPlanta(token), limite)
}

export async function buscarVehiculosPlanta(
  token: string,
  termino: string,
  limite = 40
): Promise<VehiculoSugerencia[]> {
  return extraerSugerenciasVehiculo(await cargarFormulariosPlanta(token), termino, limite)
}

export async function fetchDetalleVehiculoPlanta(
  token: string,
  chasis: string
): Promise<{ eventos: EventoLineaTiempo[]; procesos: VehiculoProceso[] }> {
  const chasisNorm = normalizarTextoBusqueda(chasis)
  if (!chasisNorm || !(await verificarTokenPlanta(token))) return { eventos: [], procesos: [] }

  const filas = await cargarFormulariosPlanta(token)
  const eventos = construirEventosLineaTiempo(
    filas.filter((f) => normalizarTextoBusqueda(vistaFormulario(f).chasis) === chasisNorm)
  )

  if (isDevBypassActive()) {
    return { eventos, procesos: await getDevPreviewProcesosVehiculo(chasis) }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('rpc_planta_procesos_vehiculo', {
    p_token: token,
    p_chasis: chasis,
  })
  if (error || !Array.isArray(data)) {
    console.error('Failed to load rpc_planta_procesos_vehiculo:', error)
    return { eventos, procesos: [] }
  }

  const procesos: VehiculoProceso[] = data.map((row) => ({
    id: row.id,
    chasis: row.chasis,
    titulo: row.titulo,
    procesoEstado: row.proceso_estado,
    observaciones: row.observaciones,
    seccionSiguiente: row.seccion_siguiente,
    creadoPorNombre: row.creado_por_nombre,
    creadoEn: row.creado_en,
  }))
  return { eventos, procesos }
}


// ── Modo planta de compras (TV de compras, sin sesión) ──────────────────────

const DATOS_PLANTA_COMPRAS_VACIOS: DatosPlantaCompras = {
  kpis: { en_curso: 0, vencidas: 0, pendientes_firma: 0, con_entregas_parciales: 0 },
  ordenes: [],
}

interface RespuestaRpcPlantaCompras {
  kpis: DatosPlantaCompras['kpis']
  ordenes: DatosPlantaCompras['ordenes']
}

/**
 * Datos de la TV de compras. Igual que la del taller, no tiene sesión: se
 * protege con un token firmado (tipo 'planta-compras') que también verifica
 * la base dentro de rpc_planta_compras. No devuelve precios ni valores.
 */
export async function fetchDatosPlantaCompras(token: string): Promise<DatosPlantaCompras> {
  const valido = await verificarTokenPlanta(token, TIPO_PLANTA_COMPRAS)
  if (!valido) return DATOS_PLANTA_COMPRAS_VACIOS

  if (isDevBypassActive()) {
    return {
      kpis: { en_curso: 2, vencidas: 1, pendientes_firma: 1, con_entregas_parciales: 1 },
      ordenes: [
        {
          id: 1, numero: 'OC-1-3195', proveedor: 'MATRICES TROQUELES Y MOLDES MATROMOL',
          fecha_pedido: '2026-01-26', fecha_vencimiento: '2026-02-10', requiere_firma: true,
          firmada: false, pedidas: 48, recibidas: 16, ultima_entrega: null,
          titulo: null, observaciones: null,
          items: [
            { codigo_producto: 'MAT-001', nombre_producto: 'Matriz de troquel', descripcion: 'Matriz de troquel para guardabarros, acero 1045, acabado pulido', cantidad: 48, cantidad_recibida: 16, proveedor_nombre: 'MATRICES TROQUELES Y MOLDES MATROMOL', observaciones: null },
          ],
        },
        {
          id: 2, numero: null, proveedor: 'COAUTOPARTES', fecha_pedido: '2026-01-20',
          fecha_vencimiento: null, requiere_firma: false, firmada: false, pedidas: 100,
          recibidas: 0, ultima_entrega: null, titulo: null, observaciones: null, items: [],
        },
      ],
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('rpc_planta_compras', { p_token: token })
  if (error || !data) {
    console.error('Failed to load rpc_planta_compras:', error)
    return DATOS_PLANTA_COMPRAS_VACIOS
  }

  const r = data as RespuestaRpcPlantaCompras
  return {
    kpis: {
      en_curso: Number(r.kpis?.en_curso ?? 0),
      vencidas: Number(r.kpis?.vencidas ?? 0),
      pendientes_firma: Number(r.kpis?.pendientes_firma ?? 0),
      con_entregas_parciales: Number(r.kpis?.con_entregas_parciales ?? 0),
    },
    ordenes: (r.ordenes ?? []).map((o) => ({
      ...o,
      pedidas: Number(o.pedidas),
      recibidas: Number(o.recibidas),
      items: (o.items ?? []).map((i) => ({
        ...i,
        cantidad: Number(i.cantidad),
        cantidad_recibida: Number(i.cantidad_recibida ?? 0),
      })),
    })),
  }
}
