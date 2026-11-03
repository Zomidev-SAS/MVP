import type { Carpeta } from '@/lib/archivos/matriz'
import type { ArchivoItem } from '@/lib/types/archivos'

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString()

/** Archivos de muestra solo para el modo vista previa (DEV_SKIP_AUTH). Viven en memoria del servidor de desarrollo. */
const store: Partial<Record<Carpeta, ArchivoItem[]>> = {
  administracion: [{ nombre: 'Acta-junta-octubre.pdf', tamano: 412_000, modificado: hace(6) }],
  almacen: [
    { nombre: 'Inventario-fisico-2026.xlsx', tamano: 1_840_000, modificado: hace(2) },
    { nombre: 'Guia-recepcion-mercancia.pdf', tamano: 220_500, modificado: hace(15) },
  ],
  calidad: [{ nombre: 'Protocolo-inspeccion-carroceria.pdf', tamano: 980_000, modificado: hace(4) }],
  comercial: [
    { nombre: 'Cotizacion-bus-escolar-0187.pdf', tamano: 356_000, modificado: hace(1) },
    { nombre: 'Catalogo-transformaciones.pdf', tamano: 5_200_000, modificado: hace(30) },
  ],
  compras: [{ nombre: 'OC-2026-0453.pdf', tamano: 128_000, modificado: hace(3) }],
  contabilidad: [{ nombre: 'Balance-septiembre.xlsx', tamano: 760_000, modificado: hace(8) }],
  ingenieria: [
    { nombre: 'Plano-chasis-modelo-B.dwg', tamano: 14_300_000, modificado: hace(5) },
    { nombre: 'Lista-materiales-modelo-B.xlsx', tamano: 310_000, modificado: hace(5) },
  ],
  produccion: [
    { nombre: 'Foto-linea-soldadura.jpg', tamano: 2_900_000, modificado: hace(0) },
    { nombre: 'Orden-produccion-0812.pdf', tamano: 190_000, modificado: hace(2) },
  ],
  recepcion: [{ nombre: 'Registro-visitas-noviembre.pdf', tamano: 88_000, modificado: hace(1) }],
  'recursos-humanos': [{ nombre: 'Reglamento-interno.pdf', tamano: 1_100_000, modificado: hace(60) }],
  ssst: [{ nombre: 'Matriz-de-riesgos.xlsx', tamano: 540_000, modificado: hace(12) }],
  respaldos: [{ nombre: 'respaldo-servidor-2026-10-31.zip', tamano: 1_800_000_000, modificado: hace(2) }],
}

export function demoListar(carpeta: Carpeta): ArchivoItem[] {
  return [...(store[carpeta] ?? [])].sort((a, b) => (b.modificado ?? '').localeCompare(a.modificado ?? ''))
}

export function demoExiste(carpeta: Carpeta, nombre: string): boolean {
  return (store[carpeta] ?? []).some((a) => a.nombre === nombre)
}

export function demoAgregar(carpeta: Carpeta, nombre: string, tamano: number): void {
  store[carpeta] = [...(store[carpeta] ?? []), { nombre, tamano, modificado: new Date().toISOString() }]
}

export function demoBorrar(carpeta: Carpeta, nombre: string): void {
  store[carpeta] = (store[carpeta] ?? []).filter((a) => a.nombre !== nombre)
}
