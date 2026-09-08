import type { EntradaInput } from '@/lib/types/entradas'

export interface FilaCsv {
  numeroFila: number
  valores: Record<string, string>
  valida: boolean
  datos?: EntradaInput
  errores: string[]
}

export type ImportarResultado =
  | { ok: true; insertados: number }
  | { ok: false; error: string }
