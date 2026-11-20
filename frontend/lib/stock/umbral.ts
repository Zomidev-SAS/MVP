export interface UmbralesStock {
  general: number
  porCategoria: Record<string, number>
}

/** Umbral que aplica a una categoría: el propio si lo tiene, si no el general. */
export function umbralDeCategoria(umbrales: UmbralesStock, categoria: string | null): number {
  const propio = categoria ? umbrales.porCategoria[categoria] : undefined
  return propio ?? umbrales.general
}
