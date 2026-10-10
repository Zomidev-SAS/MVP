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
