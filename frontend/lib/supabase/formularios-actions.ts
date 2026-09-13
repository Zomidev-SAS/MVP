'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import { getDevPreviewFormulariosData } from '@/lib/dev/preview-formularios-data'
import { filtrarYOrdenarFormularios, normalizarFormularios } from '@/lib/formularios/normalize'
import { extraerOpcionesFiltro } from '@/lib/formularios/opciones-filtro'
import { FORMULARIOS_PAGE_SIZE } from '@/lib/supabase/formularios-page-size'
import type { FormulariosFiltros, FormulariosPagina } from '@/lib/types/formularios'

const MAX_FORMULARIOS_CARGA = 2000

export async function fetchFormularios(
  filtros: FormulariosFiltros,
  pagina: number
): Promise<FormulariosPagina> {
  if (isDevBypassActive()) {
    return fetchFormulariosPreview(filtros, pagina)
  }

  const supabase = await createClient()

  const { data, error, count } = await supabase
    .from('formularios')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(MAX_FORMULARIOS_CARGA)

  if (error) {
    console.error('Failed to load formularios:', error)
    return {
      filas: [],
      total: 0,
      totalDb: 0,
      opcionesFiltro: [],
      error: error.message,
    }
  }

  const totalDb = count ?? data?.length ?? 0
  const todasNormalizadas = normalizarFormularios(data)
  const opcionesFiltro = extraerOpcionesFiltro(todasNormalizadas)
  const normalizadas = filtrarYOrdenarFormularios(todasNormalizadas, filtros)

  const from = (pagina - 1) * FORMULARIOS_PAGE_SIZE
  const to = from + FORMULARIOS_PAGE_SIZE

  let errorMsg: string | undefined
  if (totalDb === 0) {
    errorMsg =
      'La tabla formularios está vacía o RLS bloquea la lectura. Verifica permisos en Supabase.'
  } else if (normalizadas.length === 0) {
    errorMsg = 'Hay registros en la base pero ninguno coincide con los filtros actuales.'
  }

  return {
    filas: normalizadas.slice(from, to),
    total: normalizadas.length,
    totalDb,
    opcionesFiltro,
    error: errorMsg,
  }
}

function fetchFormulariosPreview(
  filtros: FormulariosFiltros,
  pagina: number
): FormulariosPagina {
  const todas = getDevPreviewFormulariosData()
  const opcionesFiltro = extraerOpcionesFiltro(todas)
  const filtradas = filtrarYOrdenarFormularios(todas, filtros)

  const from = (pagina - 1) * FORMULARIOS_PAGE_SIZE
  const to = from + FORMULARIOS_PAGE_SIZE

  return {
    filas: filtradas.slice(from, to),
    total: filtradas.length,
    totalDb: todas.length,
    opcionesFiltro,
  }
}
