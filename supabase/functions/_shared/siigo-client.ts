const SIIGO_API = 'https://api.siigo.com'

let tokenCache: { token: string; expiresAt: number } | null = null

function partnerId(): string {
  const id = Deno.env.get('SIIGO_PARTNER_ID')?.trim()
  if (!id) throw new Error('SIIGO_PARTNER_ID no configurado')
  return id
}

function credenciales(): { username: string; access_key: string } {
  const username = Deno.env.get('SIIGO_USERNAME')?.trim()
  const access_key = Deno.env.get('SIIGO_ACCESS_KEY')?.trim()
  if (!username || !access_key) {
    throw new Error('SIIGO_USERNAME o SIIGO_ACCESS_KEY no configurados')
  }
  return { username, access_key }
}

export async function getSiigoAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token
  }

  const res = await fetch(`${SIIGO_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credenciales()),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Siigo auth falló (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) {
    throw new Error('Siigo auth no devolvió access_token')
  }

  const ttlMs = (data.expires_in ?? 3600) * 1000
  tokenCache = { token: data.access_token, expiresAt: Date.now() + ttlMs }
  return data.access_token
}

async function siigoGet(path: string, params?: Record<string, string>): Promise<Response> {
  const token = await getSiigoAccessToken()
  const url = new URL(`${SIIGO_API}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v)
    }
  }

  return fetch(url.toString(), {
    headers: {
      Authorization: token,
      'Partner-Id': partnerId(),
      'Content-Type': 'application/json',
    },
  })
}

export interface SiigoProductoResumen {
  code: string
  name: string
  active: boolean
}

export interface SiigoProveedorResumen {
  identification: string
  name: string
  active: boolean
}

export async function buscarProductoSiigo(codigo: string): Promise<SiigoProductoResumen | null> {
  const res = await siigoGet('/v1/products', { code: codigo, page: '1', page_size: '1' })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Siigo products (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    results?: Array<{ code?: string; name?: string; active?: boolean }>
    pagination?: { total_results?: number }
  }

  const item = data.results?.[0]
  if (!item?.code) return null

  return {
    code: item.code,
    name: item.name ?? item.code,
    active: item.active !== false,
  }
}

export async function buscarProveedorSiigo(nit: string): Promise<SiigoProveedorResumen | null> {
  const res = await siigoGet('/v1/customers', {
    identification: nit,
    page: '1',
    page_size: '1',
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Siigo customers (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    results?: Array<{
      identification?: string
      name?: string[] | string
      commercial_name?: string
      active?: boolean
    }>
  }

  const item = data.results?.[0]
  if (!item?.identification) return null

  const nombre = Array.isArray(item.name)
    ? item.name.filter(Boolean).join(' ')
    : item.name ?? item.commercial_name ?? item.identification

  return {
    identification: item.identification,
    name: nombre,
    active: item.active !== false,
  }
}

// ============================================================================
// B12: escritura (hasta el Avance 2 este cliente era solo de consulta).
// ============================================================================

async function siigoPost(path: string, body: unknown): Promise<Response> {
  const token = await getSiigoAccessToken()
  return fetch(`${SIIGO_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Partner-Id': partnerId(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

export interface SiigoItemCompra {
  codigo_producto: string
  descripcion: string
  cantidad: number
  // Costo unitario: si en algún momento una OC trae costo (hoy el panel no
  // lo pide en compras), se puede pasar aquí; Siigo exige un price > 0, así
  // que por defecto se manda 0 y el ajuste de costo real se hace en Siigo.
  precio_unitario?: number
}

export interface OrdenCompraParaSiigo {
  id: number
  titulo: string | null
  fecha_pedido: string | null
  proveedor_nit: string | null
  observaciones: string | null
  items: SiigoItemCompra[]
}

export interface SiigoDocumentoCreado {
  id: string
  numero: string | null
}

// NOTA (3.12 del AVANCE_2_BACKEND.pdf): "El tipo de documento de Siigo se
// confirma con contabilidad el viernes 9." Mientras esa confirmación no
// llegue, SIIGO_DOCUMENT_TYPE_ID se deja sin valor por defecto a propósito:
// esta función falla con un mensaje claro (y la Edge Function que la llama
// deja la orden en estado 'error' + notifica a compras) en vez de adivinar
// un id de tipo de documento y crear algo incorrecto en la cuenta real de
// Siigo. Una vez contabilidad confirme el tipo, basta con:
//   supabase secrets set SIIGO_DOCUMENT_TYPE_ID=<id-confirmado>
function tipoDocumentoCompra(): string {
  const id = Deno.env.get('SIIGO_DOCUMENT_TYPE_ID')?.trim()
  if (!id) {
    throw new Error(
      'SIIGO_DOCUMENT_TYPE_ID no está configurado todavía (pendiente de confirmación ' +
      'con contabilidad, ver 3.12 del documento de Avance 2). No se crea el documento en Siigo.'
    )
  }
  return id
}

// Crea el documento de compra en Siigo para una orden ya aprobada. Idempotente
// a nivel de llamador: siigo-sync-oc solo invoca esto si ordenes_compra.siigo_id
// todavía es null, así que una OC nunca se crea dos veces en Siigo.
export async function crearDocumentoCompraSiigo(
  orden: OrdenCompraParaSiigo
): Promise<SiigoDocumentoCreado> {
  if (orden.items.length === 0) {
    throw new Error(`La orden ${orden.id} no tiene líneas, no se envía a Siigo`)
  }

  const body = {
    document: { id: Number(tipoDocumentoCompra()) },
    date: orden.fecha_pedido ?? new Date().toISOString().slice(0, 10),
    supplier: orden.proveedor_nit ? { identification: orden.proveedor_nit } : undefined,
    observations: [
      orden.titulo,
      orden.observaciones,
      `Panel Carrera Arango · OC #${orden.id}`,
    ].filter(Boolean).join(' — '),
    items: orden.items.map((it) => ({
      code: it.codigo_producto,
      description: it.descripcion,
      quantity: it.cantidad,
      price: it.precio_unitario ?? 0,
    })),
  }

  const res = await siigoPost('/v1/purchases', body)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Siigo purchases (${res.status}): ${text.slice(0, 300)}`)
  }

  const data = (await res.json()) as { id?: string; number?: string; name?: string }
  if (!data.id) {
    throw new Error('Siigo no devolvió id del documento creado')
  }

  return { id: data.id, numero: data.number ?? data.name ?? null }
}

// ============================================================================
// B12: catálogo (sincronización nocturna de productos y proveedores).
// ============================================================================

export interface SiigoProductoCatalogo {
  code: string
  name: string
  active: boolean
  // precio de lista si Siigo lo trae en la primera moneda configurada; se usa
  // solo para detectar diferencias, nunca se pisa el costo real del panel.
  precio_lista: number | null
}

export async function listarProductosSiigo(page: number, pageSize = 100): Promise<{
  productos: SiigoProductoCatalogo[]
  totalPaginas: number
}> {
  const res = await siigoGet('/v1/products', { page: String(page), page_size: String(pageSize) })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Siigo products (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    results?: Array<{
      code?: string
      name?: string
      active?: boolean
      prices?: Array<{ price_list?: Array<{ value?: number }> }>
    }>
    pagination?: { total_results?: number; page_size?: number }
  }

  const productos = (data.results ?? [])
    .filter((p) => p.code)
    .map((p) => ({
      code: p.code!,
      name: p.name ?? p.code!,
      active: p.active !== false,
      precio_lista: p.prices?.[0]?.price_list?.[0]?.value ?? null,
    }))

  const totalResults = data.pagination?.total_results ?? productos.length
  const size = data.pagination?.page_size ?? pageSize
  const totalPaginas = Math.max(1, Math.ceil(totalResults / size))

  return { productos, totalPaginas }
}

export async function listarProveedoresSiigo(page: number, pageSize = 100): Promise<{
  proveedores: SiigoProveedorResumen[]
  totalPaginas: number
}> {
  const res = await siigoGet('/v1/customers', { page: String(page), page_size: String(pageSize) })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Siigo customers (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    results?: Array<{
      identification?: string
      name?: string[] | string
      commercial_name?: string
      active?: boolean
    }>
    pagination?: { total_results?: number; page_size?: number }
  }

  const proveedores = (data.results ?? [])
    .filter((p) => p.identification)
    .map((p) => ({
      identification: p.identification!,
      name: Array.isArray(p.name) ? p.name.filter(Boolean).join(' ') : p.name ?? p.commercial_name ?? p.identification!,
      active: p.active !== false,
    }))

  const totalResults = data.pagination?.total_results ?? proveedores.length
  const size = data.pagination?.page_size ?? pageSize
  const totalPaginas = Math.max(1, Math.ceil(totalResults / size))

  return { proveedores, totalPaginas }
}