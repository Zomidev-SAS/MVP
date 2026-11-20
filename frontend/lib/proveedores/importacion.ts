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
