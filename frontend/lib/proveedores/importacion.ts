import Papa from 'papaparse'
import { normalizarNit } from '@/lib/proveedores/nit'
import { guardarProveedorSchema, type GuardarProveedorInput } from '@/lib/types/proveedor'

export interface ErrorImportacion {
  linea: number
  motivo: string
}

export interface LecturaProveedores {
  filas: GuardarProveedorInput[]
  errores: ErrorImportacion[]
}

const ALIAS_COLUMNAS: Record<keyof GuardarProveedorInput, string[]> = {
  nit: ['nit', 'identificacion', 'documento', 'cedula', 'nitproveedor'],
  nombre: ['nombre', 'proveedor', 'razonsocial', 'nombreproveedor', 'nombrecompleto'],
  email: ['email', 'correo', 'correoelectronico', 'mail'],
  telefono: ['telefono', 'tel', 'celular', 'movil'],
  contacto: ['contacto', 'nombrecontacto', 'personacontacto'],
  notas: ['notas', 'nota', 'observaciones'],
}

/** Encabezado sin tildes, espacios ni signos: "Razón Social" -> "razonsocial". */
function claveEncabezado(encabezado: string): string {
  return encabezado
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function columnaDe(
  encabezados: string[],
  campo: keyof GuardarProveedorInput
): string | undefined {
  return encabezados.find((e) => ALIAS_COLUMNAS[campo].includes(claveEncabezado(e)))
}

/** Lee el CSV de proveedores (delimitador detectado solo: coma, punto y coma, tabulación). */
export function leerCsvProveedores(texto: string): LecturaProveedores {
  const resultado = Papa.parse<Record<string, string>>(texto, {
    header: true,
    skipEmptyLines: 'greedy',
  })

  const encabezados = resultado.meta.fields ?? []
  const columnas = {
    nit: columnaDe(encabezados, 'nit'),
    nombre: columnaDe(encabezados, 'nombre'),
    email: columnaDe(encabezados, 'email'),
    telefono: columnaDe(encabezados, 'telefono'),
    contacto: columnaDe(encabezados, 'contacto'),
    notas: columnaDe(encabezados, 'notas'),
  }

  if (!columnas.nit || !columnas.nombre) {
    return {
      filas: [],
      errores: [
        {
          linea: 1,
          motivo: 'El archivo necesita al menos las columnas NIT y Nombre en la primera fila.',
        },
      ],
    }
  }

  const filas: GuardarProveedorInput[] = []
  const errores: ErrorImportacion[] = []
  const vistos = new Set<string>()

  resultado.data.forEach((registro, indice) => {
    // La fila 1 es el encabezado, así que el primer dato está en la línea 2.
    const linea = indice + 2
    const candidato = {
      nit: registro[columnas.nit!] ?? '',
      nombre: registro[columnas.nombre!] ?? '',
      email: columnas.email ? (registro[columnas.email] ?? '') : '',
      telefono: columnas.telefono ? (registro[columnas.telefono] ?? '') : '',
      contacto: columnas.contacto ? (registro[columnas.contacto] ?? '') : '',
      notas: columnas.notas ? (registro[columnas.notas] ?? '') : '',
    }

    const validado = guardarProveedorSchema.safeParse(candidato)
    if (!validado.success) {
      errores.push({ linea, motivo: validado.error.issues[0]?.message ?? 'Fila inválida' })
      return
    }

    const clave = normalizarNit(validado.data.nit)
    if (vistos.has(clave)) {
      errores.push({ linea, motivo: 'NIT repetido en el archivo' })
      return
    }
    vistos.add(clave)
    filas.push(validado.data)
  })

  return { filas, errores }
}

// ---------------------------------------------------------------------------
// Historial de desempeño (cuadro de control de entregas en Excel/CSV)
// ---------------------------------------------------------------------------

export type FormatoFecha = 'dmy' | 'mdy'

export interface FilaHistorialImportada {
  numero_oc: string
  fecha_oc: string | null
  fecha_entrega_prometida: string | null
  fecha_entrega_real: string | null
  devoluciones: number
  observaciones: string | null
  factura_remision: string | null
}

export interface LecturaHistorial {
  filas: FilaHistorialImportada[]
  errores: ErrorImportacion[]
}

const ALIAS_HISTORIAL: Record<
  'numero_oc' | 'fecha_oc' | 'prometida' | 'real' | 'devoluciones' | 'observaciones' | 'factura',
  string[]
> = {
  numero_oc: ['ordendecompra', 'oc', 'numerooc', 'orden', 'numerodeorden'],
  fecha_oc: ['fechadeoc', 'fechaoc', 'fechaorden', 'fechadeorden'],
  prometida: ['fechadeentrega', 'fechaentrega', 'entregaprometida', 'fechaprometida'],
  real: ['fecharealdeentrega', 'fecharealentrega', 'fechareal', 'entregareal'],
  devoluciones: ['devoluciones', 'devolucion'],
  observaciones: ['observaciones', 'observacion', 'notas'],
  factura: ['facturaoremision', 'factura', 'remision', 'facturaremision', 'facturaremision'],
}

const PATRON_FECHA_BARRAS = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/
const PATRON_FECHA_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/

function columnaHistorial(encabezados: string[], campo: keyof typeof ALIAS_HISTORIAL) {
  return encabezados.find((e) => ALIAS_HISTORIAL[campo].includes(claveEncabezado(e)))
}

function aIso(anio: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  if (fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Convierte una fecha del archivo a aaaa-mm-dd. undefined = vacía; null = no se entiende. */
export function convertirFecha(valor: string, formato: FormatoFecha): string | null | undefined {
  const texto = valor.trim()
  if (!texto) return undefined
  const iso = texto.match(PATRON_FECHA_ISO)
  if (iso) return aIso(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  const barras = texto.match(PATRON_FECHA_BARRAS)
  if (!barras) return null
  const [a, b, anio] = [Number(barras[1]), Number(barras[2]), Number(barras[3])]
  return formato === 'dmy' ? aIso(anio, b, a) : aIso(anio, a, b)
}

interface TablaHistorial {
  encabezados: string[]
  /** Registros por encabezado, con su número de línea en el archivo. */
  registros: Array<{ linea: number; datos: Record<string, string> }>
}

/**
 * El cuadro de control suele traer filas de título (logo, "PROCESO DE COMPRAS…", versión)
 * antes de los encabezados: se busca la primera fila que tenga la columna de la orden de compra.
 */
function tablaHistorial(texto: string): TablaHistorial | null {
  const resultado = Papa.parse<string[]>(texto, { skipEmptyLines: false })
  const filas = resultado.data
  const indiceEncabezado = filas.findIndex((fila) =>
    fila.some((celda) => ALIAS_HISTORIAL.numero_oc.includes(claveEncabezado(celda ?? '')))
  )
  if (indiceEncabezado === -1) return null

  const encabezados = filas[indiceEncabezado].map((celda) => (celda ?? '').trim())
  const registros: TablaHistorial['registros'] = []
  for (let i = indiceEncabezado + 1; i < filas.length; i++) {
    const fila = filas[i]
    if (!fila || fila.every((celda) => !(celda ?? '').trim())) continue
    const datos: Record<string, string> = {}
    encabezados.forEach((encabezado, j) => {
      if (encabezado) datos[encabezado] = fila[j] ?? ''
    })
    registros.push({ linea: i + 1, datos })
  }
  return { encabezados, registros }
}

/**
 * Mira las fechas con barras: si algún primer número pasa de 12 es día/mes; si algún segundo
 * pasa de 12 es mes/día. Si no hay pistas, o hay de los dos tipos, hay que preguntar.
 */
export function detectarFormatoFecha(texto: string): FormatoFecha | 'ambiguo' {
  const tabla = tablaHistorial(texto)
  if (!tabla) return 'ambiguo'
  const columnas = (['fecha_oc', 'prometida', 'real'] as const)
    .map((campo) => columnaHistorial(tabla.encabezados, campo))
    .filter((c): c is string => !!c)

  let dmy = false
  let mdy = false
  for (const { datos } of tabla.registros) {
    for (const columna of columnas) {
      const coincidencia = (datos[columna] ?? '').trim().match(PATRON_FECHA_BARRAS)
      if (!coincidencia) continue
      if (Number(coincidencia[1]) > 12) dmy = true
      if (Number(coincidencia[2]) > 12) mdy = true
    }
  }
  if (dmy && !mdy) return 'dmy'
  if (mdy && !dmy) return 'mdy'
  return 'ambiguo'
}

/** Lee el cuadro de control: una fila por orden de compra con sus fechas y devoluciones. */
export function leerCsvHistorial(texto: string, formato: FormatoFecha): LecturaHistorial {
  const tabla = tablaHistorial(texto)
  if (!tabla) {
    return {
      filas: [],
      errores: [{ linea: 1, motivo: 'No se encontró la columna "Orden de compra" en el archivo.' }],
    }
  }

  const columnas = {
    numero_oc: columnaHistorial(tabla.encabezados, 'numero_oc'),
    fecha_oc: columnaHistorial(tabla.encabezados, 'fecha_oc'),
    prometida: columnaHistorial(tabla.encabezados, 'prometida'),
    real: columnaHistorial(tabla.encabezados, 'real'),
    devoluciones: columnaHistorial(tabla.encabezados, 'devoluciones'),
    observaciones: columnaHistorial(tabla.encabezados, 'observaciones'),
    factura: columnaHistorial(tabla.encabezados, 'factura'),
  }

  const filas: FilaHistorialImportada[] = []
  const errores: ErrorImportacion[] = []
  const vistas = new Set<string>()

  for (const { linea, datos } of tabla.registros) {
    const leer = (columna: string | undefined) => (columna ? (datos[columna] ?? '').trim() : '')

    const numeroOc = leer(columnas.numero_oc)
    if (!numeroOc) {
      errores.push({ linea, motivo: 'Falta el número de la orden de compra' })
      continue
    }
    const clave = numeroOc.toLowerCase()
    if (vistas.has(clave)) {
      errores.push({ linea, motivo: `La orden ${numeroOc} está repetida en el archivo` })
      continue
    }

    const fechas: Record<'fecha_oc' | 'prometida' | 'real', string | null> = {
      fecha_oc: null,
      prometida: null,
      real: null,
    }
    let fechaMala: string | null = null
    for (const campo of ['fecha_oc', 'prometida', 'real'] as const) {
      const convertida = convertirFecha(leer(columnas[campo]), formato)
      if (convertida === null) {
        fechaMala = leer(columnas[campo])
        break
      }
      fechas[campo] = convertida ?? null
    }
    if (fechaMala != null) {
      errores.push({ linea, motivo: `Fecha que no se entiende: "${fechaMala}"` })
      continue
    }

    const textoDevoluciones = leer(columnas.devoluciones)
    const devoluciones = textoDevoluciones === '' ? 0 : Number(textoDevoluciones)
    if (!Number.isInteger(devoluciones) || devoluciones < 0) {
      errores.push({ linea, motivo: `Devoluciones debe ser un número entero: "${textoDevoluciones}"` })
      continue
    }

    vistas.add(clave)
    filas.push({
      numero_oc: numeroOc,
      fecha_oc: fechas.fecha_oc,
      fecha_entrega_prometida: fechas.prometida,
      fecha_entrega_real: fechas.real,
      devoluciones,
      observaciones: leer(columnas.observaciones) || null,
      factura_remision: leer(columnas.factura) || null,
    })
  }

  return { filas, errores }
}
