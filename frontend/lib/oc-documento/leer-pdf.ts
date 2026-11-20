import { getDocumentProxy } from 'unpdf'
import { ErrorLecturaOc, parsearOcSiigo } from '@/lib/oc-documento/parse-siigo-oc'
import type { FragmentoTexto, OcSiigoLeida } from '@/lib/oc-documento/tipos'

export const MAX_BYTES_PDF = 5 * 1024 * 1024

/** Extrae el texto con posición de la primera página y lo interpreta como OC de Siigo. */
export async function leerOcSiigoDesdePdf(bytes: Uint8Array): Promise<OcSiigoLeida> {
  let pdf
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes))
  } catch (error) {
    console.error('No se pudo abrir el PDF de la OC:', error)
    throw new ErrorLecturaOc('No pude abrir el PDF. Verifica que no esté dañado ni protegido con contraseña.')
  }

  const pagina = await pdf.getPage(1)
  const vista = pagina.getViewport({ scale: 1 })
  const contenido = await pagina.getTextContent()

  const fragmentos: FragmentoTexto[] = []
  for (const item of contenido.items) {
    if (!('str' in item) || !item.str.trim()) continue
    const [a, b, c, d, e, f] = item.transform as number[]
    fragmentos.push({
      texto: item.str,
      x: e,
      y: f,
      alto: item.height || Math.hypot(c, d) || 10,
      rotado: Math.abs(b) > 0.01 || Math.abs(c) > 0.01 || a < 0,
    })
  }

  if (fragmentos.length === 0) {
    throw new ErrorLecturaOc('El PDF no tiene texto seleccionable (parece una imagen escaneada).')
  }

  return parsearOcSiigo(fragmentos, { ancho: vista.width, alto: vista.height })
}
