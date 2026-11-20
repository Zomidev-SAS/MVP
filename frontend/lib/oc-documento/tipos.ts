/** Fragmento de texto de una página PDF (origen abajo-izquierda, como pdf.js). */
export interface FragmentoTexto {
  texto: string
  x: number
  y: number
  alto: number
  /** Texto girado (el pie vertical "Elaborado por Siigo"): se ignora al leer. */
  rotado?: boolean
}

export interface LineaOcSiigo {
  descripcion: string
  cantidad: number
  precio_unitario: number
  total: number
}

/** Dónde hay hueco libre en la hoja para estampar la firma. */
export interface DiseñoPagina {
  ancho: number
  alto: number
  /** Borde izquierdo del texto de observaciones (donde se alinea la firma). */
  xObservaciones: number | null
  /** Borde inferior de la última fila de la tabla. */
  yBajoTabla: number | null
  /** Borde superior del texto "Observaciones". */
  ySobreObservaciones: number | null
}

export interface OcSiigoLeida {
  numero_oc: string
  fecha: string | null
  proveedor_nombre: string
  proveedor_nit: string
  observaciones: string | null
  total_pagar: number | null
  lineas: LineaOcSiigo[]
  diseño: DiseñoPagina
}
