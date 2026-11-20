/**
 * La tabla o columna todavía no existe en Supabase (la migración no se ha aplicado):
 * Postgres 42P01 / 42703 o el equivalente de PostgREST cuando no la encuentra en su caché.
 */
export function esMigracionPendiente(error: { code?: string } | null | undefined): boolean {
  const codigo = error?.code
  return codigo === '42P01' || codigo === '42703' || codigo === 'PGRST205' || codigo === 'PGRST204'
}
