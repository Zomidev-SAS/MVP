export interface ImportarResultado {
  exitosas: number
  errores: { fila: number; motivo: string }[]
  abortado: boolean
  motivo_abortado?: string
}
