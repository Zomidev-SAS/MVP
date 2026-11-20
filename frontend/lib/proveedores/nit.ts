/** Solo los dígitos del NIT: "890.900.123-4" y "8909001234" se comparan como el mismo. */
export function normalizarNit(nit: string | null | undefined): string {
  return (nit ?? '').replace(/\D/g, '')
}

/** Texto sin tildes ni mayúsculas para buscar por nombre. */
export function normalizarTexto(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}
