// B12: bajada de catálogo (productos y proveedores) desde Siigo.
// Corre sola todas las noches a las 12 a. m. hora de Colombia (pg_cron, 063) y
// también puede invocarse bajo demanda (supervisor/compras con su JWT).
//
// Trae solo lo nuevo o modificado desde la última bajada exitosa (updated_start
// de Siigo) y lo compara EN MEMORIA contra el panel. Antes hacía una consulta a
// la base por cada registro de Siigo y nunca terminaba (las cuatro últimas
// noches quedaron "en curso" sin cerrar).
//
// Nunca borra ni pisa información: toda diferencia queda en
// siigo_catalogo_diferencias para revisión manual (punto 3.12), sin duplicar
// las que ya están pendientes de revisar.
//
// Body opcional:
//   { completo: true }  ignora la última bajada y recorre todo el catálogo
//   { dry_run: true }   solo cuenta, no guarda ni notifica
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { isValidServiceRoleRequest } from '../_shared/internal-auth.ts'
import { listarProductosSiigo, listarProveedoresSiigo } from '../_shared/siigo-client.ts'

const ROLES_BAJO_DEMANDA = ['supervisor', 'compras']
// La plataforma corta las funciones a los ~150 s: se frena antes para poder
// registrar el resultado en vez de quedar "en curso" para siempre.
const LIMITE_MS = 120_000
const MARGEN_SEGURIDAD_MS = 24 * 60 * 60 * 1000

interface Diferencia {
  tipo: 'producto' | 'proveedor'
  codigo: string
  campo: string
  valor_panel: string | null
  valor_siigo: string | null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const esLlamadaInterna = isValidServiceRoleRequest(req)
  if (!esLlamadaInterna) {
    const ok = await esUsuarioAutorizado(req)
    if (!ok) return json({ error: 'Unauthorized' }, 401)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('MI_SERVICE_ROLE_KEY')!
  )

  let body: { sync_pendiente_id?: number; completo?: boolean; dry_run?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    // body vacío (cron) también es válido
  }

  const inicio = Date.now()
  const dryRun = body.dry_run === true

  // Las pruebas (dry_run) quedan en su propia regla para no tocar el estado
  // que muestra el panel.
  const { data: logId } = await admin.rpc('fn_log_automatizacion_iniciar', {
    p_regla: dryRun ? 'siigo_sync_catalogo_prueba' : 'siigo_sync_catalogo',
    p_detalle: {
      origen: esLlamadaInterna ? 'cron_o_reintento' : 'bajo_demanda',
      completo: body.completo === true,
    },
  })

  try {
    const desde = await calcularDesde(admin, body.completo === true)

    // Estado local, cargado una sola vez.
    const productosLocales = await cargarProductosLocales(admin)
    const proveedoresLocales = await cargarProveedoresLocales(admin)
    const pendientes = await cargarPendientes(admin)

    const nuevas: Diferencia[] = []
    const agregar = (d: Diferencia) => {
      const clave = claveDiferencia(d.tipo, d.codigo, d.campo, d.valor_siigo)
      if (pendientes.has(clave)) return
      pendientes.add(clave)
      nuevas.push(d)
    }

    // ── Productos ────────────────────────────────────────────────────────
    let vistosProductos = 0
    let pagina = 1
    let totalPaginas = 1
    do {
      verificarTiempo(inicio, `productos, página ${pagina}`)
      const { productos, totalPaginas: tp } = await listarProductosSiigo(pagina, 100, desde ?? undefined)
      totalPaginas = tp

      for (const prod of productos) {
        vistosProductos++
        const local = productosLocales.get(prod.code)
        if (local === undefined) {
          agregar({
            tipo: 'producto', codigo: prod.code, campo: 'existencia',
            valor_panel: null, valor_siigo: 'existe en Siigo, no en el panel',
          })
        } else if (normalizar(local) !== normalizar(prod.name)) {
          agregar({
            tipo: 'producto', codigo: prod.code, campo: 'nombre',
            valor_panel: local, valor_siigo: prod.name,
          })
        }
      }
      pagina++
    } while (pagina <= totalPaginas)

    // ── Proveedores ──────────────────────────────────────────────────────
    let vistosProveedores = 0
    pagina = 1
    totalPaginas = 1
    do {
      verificarTiempo(inicio, `proveedores, página ${pagina}`)
      const { proveedores, totalPaginas: tp } = await listarProveedoresSiigo(pagina, 100, desde ?? undefined)
      totalPaginas = tp

      for (const prov of proveedores) {
        vistosProveedores++
        const nombreLocal = proveedoresLocales.get(prov.identification)
        if (nombreLocal !== undefined && normalizar(nombreLocal) !== normalizar(prov.name)) {
          agregar({
            tipo: 'proveedor', codigo: prov.identification, campo: 'nombre',
            valor_panel: nombreLocal, valor_siigo: prov.name,
          })
        }
      }
      pagina++
    } while (pagina <= totalPaginas)

    const resumen = {
      desde,
      dry_run: dryRun,
      productos_revisados: vistosProductos,
      proveedores_revisados: vistosProveedores,
      diferencias_nuevas: nuevas.length,
      productos: nuevas.filter((d) => d.tipo === 'producto').length,
      proveedores: nuevas.filter((d) => d.tipo === 'proveedor').length,
      duracion_ms: Date.now() - inicio,
    }

    if (dryRun) {
      await admin.from('log_automatizaciones').update({ detalle: resumen }).eq('id', logId)
      await admin.rpc('fn_log_automatizacion_cerrar', {
        p_id: logId, p_resultado: 'ok', p_filas_afectadas: nuevas.length, p_error: null,
      })
      return json({ ok: true, ...resumen })
    }

    for (let i = 0; i < nuevas.length; i += 500) {
      const { error } = await admin.from('siigo_catalogo_diferencias').insert(nuevas.slice(i, i + 500))
      if (error) throw new Error(`No se pudieron guardar las diferencias: ${error.message}`)
    }

    await admin.rpc('fn_log_automatizacion_cerrar', {
      p_id: logId,
      p_resultado: 'ok',
      p_filas_afectadas: nuevas.length,
      p_error: null,
    })

    if (body.sync_pendiente_id) {
      await admin.rpc('fn_registrar_intento_sync', { p_id: body.sync_pendiente_id, p_exitoso: true })
    }

    // Aviso para validar lo nuevo que bajó de Siigo.
    if (nuevas.length > 0) {
      await admin.rpc('fn_crear_notificacion', {
        p_tipo: 'siigo_catalogo_nuevo',
        p_titulo: 'Novedades de Siigo para validar',
        p_mensaje: `La bajada de Siigo trajo ${nuevas.length} diferencia(s) con el panel `
          + `(${resumen.productos} de productos, ${resumen.proveedores} de proveedores). Revísalas en Compras.`,
        p_enlace: '/compras',
        p_usuario_destino: null,
        p_rol_destino: 'compras',
      })
    }

    return json({ ok: true, ...resumen })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'

    if (logId) {
      await admin.rpc('fn_log_automatizacion_cerrar', {
        p_id: logId, p_resultado: 'error', p_filas_afectadas: 0, p_error: msg,
      })
    }

    if (!dryRun) {
      if (body.sync_pendiente_id) {
        await admin.rpc('fn_registrar_intento_sync', { p_id: body.sync_pendiente_id, p_exitoso: false, p_motivo: msg })
      } else {
        await admin.rpc('fn_encolar_sync_pendiente', {
          p_tipo: 'siigo_catalogo',
          p_referencia_id: 'catalogo_nocturno',
          p_payload: {},
          p_motivo: msg,
        })
        await admin.rpc('fn_crear_notificacion', {
          p_tipo: 'siigo_error',
          p_titulo: 'Falló la bajada de catálogo de Siigo',
          p_mensaje: msg,
          p_enlace: '/automatizaciones',
          p_usuario_destino: null,
          p_rol_destino: 'compras',
        })
      }
    }

    return json({ ok: false, error: msg }, 502)
  }
})

function verificarTiempo(inicio: number, donde: string) {
  if (Date.now() - inicio > LIMITE_MS) {
    throw new Error(
      `La bajada superó el tiempo máximo (${Math.round(LIMITE_MS / 1000)} s) en ${donde}. `
      + 'Se reintenta automáticamente; si se repite hay que dividir el catálogo.'
    )
  }
}

// deno-lint-ignore no-explicit-any
async function calcularDesde(admin: any, completo: boolean): Promise<string | null> {
  if (completo) return null
  const { data } = await admin
    .from('log_automatizaciones')
    .select('inicio')
    .eq('regla', 'siigo_sync_catalogo')
    .eq('resultado', 'ok')
    .order('inicio', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.inicio) return null
  // Un día de margen por si una bajada anterior dejó cambios sin ver.
  return new Date(new Date(data.inicio).getTime() - MARGEN_SEGURIDAD_MS).toISOString()
}

// deno-lint-ignore no-explicit-any
async function cargarProductosLocales(admin: any): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  const { data, error } = await admin
    .from('productos')
    .select('codigo_producto, nombre_producto')
    .limit(20000)
  if (error) throw new Error(`No se pudo leer el catálogo del panel: ${error.message}`)
  for (const p of data ?? []) mapa.set(p.codigo_producto, p.nombre_producto)
  return mapa
}

// deno-lint-ignore no-explicit-any
async function cargarProveedoresLocales(admin: any): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  const { data, error } = await admin
    .from('orden_compra_items')
    .select('proveedor_nit, proveedor_nombre, id')
    .not('proveedor_nit', 'is', null)
    .not('proveedor_nombre', 'is', null)
    .order('id', { ascending: false })
    .limit(20000)
  if (error) throw new Error(`No se pudieron leer los proveedores del panel: ${error.message}`)
  // El más reciente de cada NIT gana (viene ordenado de nuevo a viejo).
  for (const r of data ?? []) {
    if (!mapa.has(r.proveedor_nit)) mapa.set(r.proveedor_nit, r.proveedor_nombre)
  }
  return mapa
}

// deno-lint-ignore no-explicit-any
async function cargarPendientes(admin: any): Promise<Set<string>> {
  const claves = new Set<string>()
  const { data, error } = await admin
    .from('siigo_catalogo_diferencias')
    .select('tipo, codigo, campo, valor_siigo')
    .eq('revisado', false)
    .limit(50000)
  if (error) throw new Error(`No se pudieron leer las diferencias pendientes: ${error.message}`)
  for (const d of data ?? []) claves.add(claveDiferencia(d.tipo, d.codigo, d.campo, d.valor_siigo))
  return claves
}

function claveDiferencia(tipo: string, codigo: string, campo: string, valorSiigo: string | null): string {
  return `${tipo}|${codigo}|${campo}|${valorSiigo ?? ''}`
}

/** Mayúsculas, sin tildes y con espacios simples: evita "diferencias" que son solo de formato. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

async function esUsuarioAutorizado(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return false

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('MI_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: userData } = await supabaseUser.auth.getUser(token)
  if (!userData?.user) return false

  const { data: perfil } = await supabaseUser
    .from('profiles')
    .select('rol, activo')
    .eq('id', userData.user.id)
    .maybeSingle()

  return !!perfil?.activo && ROLES_BAJO_DEMANDA.includes(perfil.rol)
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
