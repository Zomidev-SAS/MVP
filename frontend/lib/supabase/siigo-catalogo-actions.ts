'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { PREVIEW_SIIGO_CATALOGO } from '@/lib/dev/preview-siigo-catalogo-data'
import type { SiigoCatalogoDiferencia, SiigoCatalogoEstado } from '@/lib/types/siigo'

interface FilaDiferencia {
  id: number
  tipo: 'producto' | 'proveedor'
  codigo: string
  campo: string
  valor_panel: string | null
  valor_siigo: string | null
  created_at: string
}

interface FilaLog {
  fin: string | null
  inicio: string
  resultado: 'en_curso' | 'ok' | 'error'
  error: string | null
}

// siigo_catalogo_diferencias y vista_log_automatizaciones_ultimo_estado ya
// existen desde B12 (migración 044/036) — nunca se construyó pantalla que
// los mostrara (docs/ESTADO_SECCION_2.md, "Pendiente, no bloqueado por
// backend"). Solo se agregó rpc_marcar_diferencia_siigo_revisada (050) para
// no dar UPDATE directo sobre la tabla.
export async function fetchSiigoCatalogoEstado(): Promise<SiigoCatalogoEstado> {
  if (isDevBypassActive()) return PREVIEW_SIIGO_CATALOGO

  const supabase = await createClient()

  const [{ data: diferencias, error: errorDiferencias }, { data: logs }] = await Promise.all([
    supabase
      .from('siigo_catalogo_diferencias')
      .select('id, tipo, codigo, campo, valor_panel, valor_siigo, created_at')
      .eq('revisado', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('vista_log_automatizaciones_ultimo_estado')
      .select('fin, inicio, resultado, error')
      .eq('regla', 'siigo_sync_catalogo')
      .maybeSingle(),
  ])

  if (errorDiferencias) {
    throw new Error(`No se pudieron cargar las diferencias de catálogo: ${errorDiferencias.message}`)
  }

  const filas = (diferencias ?? []) as FilaDiferencia[]
  const log = logs as FilaLog | null

  return {
    diferencias: filas.map((f): SiigoCatalogoDiferencia => ({
      id: f.id,
      tipo: f.tipo,
      codigo: f.codigo,
      campo: f.campo,
      valorPanel: f.valor_panel,
      valorSiigo: f.valor_siigo,
      creadoEn: f.created_at,
    })),
    ultimaSincronizacion: log
      ? { fecha: log.fin ?? log.inicio, resultado: log.resultado, error: log.error }
      : null,
  }
}

export async function marcarDiferenciaSiigoRevisada(
  id: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Server Action expuesta al cliente (importada por un Client Component):
  // el gate de rol real está en rpc_marcar_diferencia_siigo_revisada, esto
  // solo evita una llamada inútil desde roles que la UI ya no les muestra.
  const auth = await requireRole(['supervisor', 'compras'])
  if (!auth.ok) return { ok: false, error: auth.error }
  if (isDevBypassActive()) return { ok: true }

  const supabase = await createClient()
  const { error } = await supabase.rpc('rpc_marcar_diferencia_siigo_revisada', { p_id: id })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
