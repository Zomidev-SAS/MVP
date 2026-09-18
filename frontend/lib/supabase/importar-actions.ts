'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'
import type { ImportarResultado } from '@/lib/types/importar'

export async function importarCsv(formData: FormData): Promise<ImportarResultado> {
  if (isDevBypassActive()) {
    await new Promise((resolve) => setTimeout(resolve, 800))
    return { exitosas: 12, errores: [], abortado: false }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.functions.invoke('importar-inventario-csv', {
    body: formData,
  })

  if (error) {
    console.error('Failed to invoke importar-inventario-csv:', error)
    return {
      exitosas: 0,
      errores: [{ fila: 0, motivo: 'No se pudo importar. Intenta de nuevo.' }],
      abortado: true,
    }
  }

  return data as ImportarResultado
}
