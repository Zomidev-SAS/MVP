/** Valida Bearer === service role (invocaciones internas desde trigger/vault). */
export function isValidServiceRoleRequest(req: Request): boolean {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return false

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  const serviceKey = Deno.env.get('MI_SERVICE_ROLE_KEY')

  return !!token && !!serviceKey && token === serviceKey
}
