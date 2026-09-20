'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevBypassActive } from '@/lib/dev/preview-bypass'

const DEFAULT_UMBRAL_STOCK_BAJO = 2

export async function getUmbralStockBajo(): Promise<number> {
  if (isDevBypassActive()) {
    return DEFAULT_UMBRAL_STOCK_BAJO
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('config_app')
    .select('umbral_stock_bajo')
    .eq('id', 1)
    .maybeSingle()

  if (error || !data?.umbral_stock_bajo) {
    if (error) console.error('Failed to load umbral_stock_bajo:', error)
    return DEFAULT_UMBRAL_STOCK_BAJO
  }

  return data.umbral_stock_bajo
}
