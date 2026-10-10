// B12: sincronización de catálogo (productos y proveedores) desde Siigo.
// Corre sola cada noche (pg_cron, 040) y también puede invocarse bajo
// demanda (un supervisor/compras desde el panel, pasando por esta misma
// función con su JWT — ver verificación de rol abajo).
//
// Nunca borra información sola: toda diferencia encontrada entre el panel y
// Siigo queda registrada en siigo_catalogo_diferencias (044) para revisión
// manual, tal como pide el punto 3.12.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { isValidServiceRoleRequest } from '../_shared/internal-auth.ts'
import { listarProductosSiigo, listarProveedoresSiigo } from '../_shared/siigo-client.ts'

const ROLES_BAJO_DEMANDA = ['supervisor', 'compras']

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

  let body: { sync_pendiente_id?: number } = {}
  try {
    body = await req.json()
  } catch {
    // body vacío (cron) también es válido
  }

  const { data: logId } = await admin.rpc('fn_log_automatizacion_iniciar', {
    p_regla: 'siigo_sync_catalogo',
    p_detalle: { origen: esLlamadaInterna ? 'cron_o_reintento' : 'bajo_demanda' },
  })

  try {
    const diferencias = { productos: 0, proveedores: 0 }

    // Productos
    let pagina = 1
    let totalPaginas = 1
    const codigosSiigo = new Set<string>()
    do {
      const { productos, totalPaginas: tp } = await listarProductosSiigo(pagina)
      totalPaginas = tp

      for (const prod of productos) {
        codigosSiigo.add(prod.code)

        const { data: local } = await admin
          .from('productos')
          .select('codigo_producto, nombre_producto')
          .eq('codigo_producto', prod.code)
          .maybeSingle()

        if (!local) {
          await registrarDiferencia(admin, 'producto', prod.code, 'existencia', null, 'existe en Siigo, no en el panel')
          diferencias.productos++
        } else if (local.nombre_producto !== prod.name) {
          await registrarDiferencia(admin, 'producto', prod.code, 'nombre', local.nombre_producto, prod.name)
          diferencias.productos++
        }
      }
      pagina++
    } while (pagina <= totalPaginas)

    // Proveedores
    pagina = 1
    totalPaginas = 1
    do {
      const { proveedores, totalPaginas: tp } = await listarProveedoresSiigo(pagina)
      totalPaginas = tp

      for (const prov of proveedores) {
        const { data: local } = await admin
          .from('ordenes_compra')
          .select('proveedor_nombre')
          .eq('proveedor_nit', prov.identification)
          .limit(1)
          .maybeSingle()

        if (local && local.proveedor_nombre !== prov.name) {
          await registrarDiferencia(admin, 'proveedor', prov.identification, 'nombre', local.proveedor_nombre, prov.name)
          diferencias.proveedores++
        }
      }
      pagina++
    } while (pagina <= totalPaginas)

    await admin.rpc('fn_log_automatizacion_cerrar', {
      p_id: logId,
      p_resultado: 'ok',
      p_filas_afectadas: diferencias.productos + diferencias.proveedores,
      p_error: null,
    })

    if (body.sync_pendiente_id) {
      await admin.rpc('fn_registrar_intento_sync', { p_id: body.sync_pendiente_id, p_exitoso: true })
    }

    return json({ ok: true, diferencias })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'

    await admin.rpc('fn_log_automatizacion_cerrar', {
      p_id: logId, p_resultado: 'error', p_filas_afectadas: 0, p_error: msg,
    })

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
        p_titulo: 'Falló la sincronización nocturna de catálogo con Siigo',
        p_mensaje: msg,
        p_enlace: '/automatizaciones',
        p_usuario_destino: null,
        p_rol_destino: 'compras',
      })
    }

    return json({ ok: false, error: msg }, 502)
  }
})

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

// deno-lint-ignore no-explicit-any
async function registrarDiferencia(
  admin: any,
  tipo: 'producto' | 'proveedor',
  codigo: string,
  campo: string,
  valorPanel: string | null,
  valorSiigo: string | null
) {
  await admin.from('siigo_catalogo_diferencias').insert({
    tipo, codigo, campo, valor_panel: valorPanel, valor_siigo: valorSiigo,
  })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
