import { datosGeneralesDe, valorDbColumna } from '@/lib/formularios/db-columns'
import { formatearFechaConHora, formatearSoloFecha } from '@/lib/formularios/fechas'
import {
  labelTipoFormulario,
  type FormularioListado,
} from '@/lib/types/formularios'

export interface CampoDetalleFormulario {
  clave: string
  etiqueta: string
  valor: string
}

export interface SeccionDetalleFormulario {
  titulo: string
  filas: CampoDetalleFormulario[]
}

export interface DetalleFormularioVista {
  chasis: string
  tipoLabel: string
  fechaIngreso: string | null
  fechaSalida: string | null
  secciones: SeccionDetalleFormulario[]
}

const DATOS_VEHICULO: Array<{ clave: string; etiqueta: string; db?: string[] }> = [
  { clave: 'marca', etiqueta: 'Marca', db: ['dg_marca'] },
  { clave: 'modelo', etiqueta: 'Modelo' },
  { clave: 'placa', etiqueta: 'Placa' },
  { clave: 'color', etiqueta: 'Color' },
  { clave: 'tipo', etiqueta: 'Tipo vehículo', db: ['dg_tipo'] },
  { clave: 'ciudad', etiqueta: 'Ciudad', db: ['dg_ciudad'] },
  { clave: 'cliente', etiqueta: 'Cliente', db: ['dg_cliente'] },
  { clave: 'empresa', etiqueta: 'Empresa', db: ['dg_empresa'] },
  { clave: 'vendedor', etiqueta: 'Vendedor', db: ['dg_vendedor'] },
  { clave: 'kilometraje', etiqueta: 'Kilometraje', db: ['dg_kilometraje'] },
]

const REGISTRO_DB: Array<{ clave: string; etiqueta: string; esFecha?: boolean }> = [
  { clave: 'numero_formulario', etiqueta: 'Número formulario' },
  { clave: 'numeroformulario', etiqueta: 'Número formulario' },
  { clave: 'saved_at', etiqueta: 'Guardado', esFecha: true },
  { clave: 'email_destino', etiqueta: 'Email destino' },
  { clave: 'emaildestino', etiqueta: 'Email destino' },
]

export function construirDetalleFormulario(row: FormularioListado): DetalleFormularioVista {
  const db = row.dbColumns
  const raw = row.rawData
  const datosGenerales = datosGeneralesDe(raw) ?? {}

  const tipo =
    valorDbColumna(db, 'tipo_formulario') ??
    row.tipo ??
    texto(raw.tipoFormulario)

  const rawIngreso =
    valorFechaDb(db, 'fecha_ingreso', 'dg_fechaingreso') ??
    fechaTexto(datosGenerales.fechaIngreso)

  const rawSalida =
    valorFechaDb(db, 'fecha_salida') ?? fechaTexto(datosGenerales.fechaSalida)

  const chasis =
    valorDbColumna(db, 'dg_chasis') ??
    texto(datosGenerales.chasis) ??
    '—'

  const secciones: SeccionDetalleFormulario[] = []

  const vehiculo = filasDatosVehiculo(datosGenerales, db)
  if (vehiculo.length > 0) {
    secciones.push({ titulo: 'Datos del vehículo', filas: vehiculo })
  }

  const firmasFilas = construirFilasFirmas(row, db)
  if (firmasFilas.length > 0) {
    secciones.push({ titulo: 'Firmas', filas: firmasFilas })
  }

  const fotosCount = contarFotos(raw, db)
  if (fotosCount > 0) {
    secciones.push({
      titulo: 'Fotos',
      filas: [
        {
          clave: 'fotos-adjuntas',
          etiqueta: 'Adjuntas',
          valor: `${fotosCount} foto${fotosCount === 1 ? '' : 's'}`,
        },
      ],
    })
  }

  const registro = filasRegistroDb(db)
  if (registro.length > 0) {
    secciones.push({ titulo: 'Registro', filas: registro })
  }

  return {
    chasis,
    tipoLabel: labelTipoFormulario(tipo),
    fechaIngreso: formatearFechaDetalle(rawIngreso),
    fechaSalida: formatearFechaDetalle(rawSalida),
    secciones,
  }
}

function filasDatosVehiculo(
  datosGenerales: Record<string, unknown>,
  db: Record<string, unknown>
): CampoDetalleFormulario[] {
  const filas: CampoDetalleFormulario[] = []

  for (const { clave, etiqueta, db: dbClaves } of DATOS_VEHICULO) {
    const valorJson = formatearValor(datosGenerales[clave], clave)
    const valorDb = dbClaves ? valorDbColumna(db, ...dbClaves) : null
    const valor = valorJson ?? valorDb
    if (valor) filas.push({ clave: `vehiculo-${clave}`, etiqueta, valor })
  }

  return filas
}

function construirFilasFirmas(
  row: FormularioListado,
  db: Record<string, unknown>
): CampoDetalleFormulario[] {
  const firmas = objetoAnidado(row.rawData, 'firmas')
  const filas: CampoDetalleFormulario[] = []

  const bloques: Array<{ clave: string; etiqueta: string; dbNombre?: string; dbCedula?: string }> = [
    { clave: 'recibe', etiqueta: 'Recibe', dbNombre: 'firma_recibe_nombre', dbCedula: 'firma_recibe_cedula' },
    { clave: 'entrega', etiqueta: 'Entrega', dbNombre: 'firma_entrega_nombre', dbCedula: 'firma_entrega_cedula' },
    { clave: 'verifica', etiqueta: 'Verifica' },
  ]

  for (const { clave, etiqueta, dbNombre, dbCedula } of bloques) {
    const bloque = firmas[clave]
    let nombre: string | null = null
    let empresa: string | null = null
    let cedula: string | null = null

    if (bloque && typeof bloque === 'object' && !Array.isArray(bloque)) {
      const persona = bloque as Record<string, unknown>
      nombre = texto(persona.nombre)
      empresa = texto(persona.empresa)
      cedula = texto(persona.cedula)
    }

    nombre = nombre ?? (dbNombre ? valorDbColumna(db, dbNombre) : null)
    cedula = cedula ?? (dbCedula ? valorDbColumna(db, dbCedula) : null)

    const partes = [nombre, empresa, cedula ? `CC ${cedula}` : null].filter(Boolean)
    if (partes.length === 0) continue

    filas.push({ clave: `firma-${clave}`, etiqueta, valor: partes.join(' · ') })
  }

  return filas
}

function filasRegistroDb(db: Record<string, unknown>): CampoDetalleFormulario[] {
  const filas: CampoDetalleFormulario[] = []
  const vistos = new Set<string>()

  for (const { clave, etiqueta, esFecha } of REGISTRO_DB) {
    const valorRaw = db[clave]
    if (valorRaw === null || valorRaw === undefined || valorRaw === '') continue

    const valor = esFecha
      ? formatearFechaDetalle(String(valorRaw))
      : formatearValor(valorRaw, clave)

    if (!valor) continue

    const key = etiqueta.toLowerCase()
    if (vistos.has(key)) continue
    vistos.add(key)

    filas.push({ clave: `db-${clave}`, etiqueta, valor })
  }

  return filas
}

function contarFotos(raw: Record<string, unknown>, db: Record<string, unknown>): number {
  const fotosJson = Array.isArray(raw.fotos) ? raw.fotos.length : 0
  const fotoCountDb =
    typeof db.foto_count === 'number' && db.foto_count > 0 ? db.foto_count : 0

  if (fotosJson > 0) return fotosJson
  return fotoCountDb
}

function formatearFechaDetalle(valor: string | null): string | null {
  if (!valor) return null
  const t = valor.trim()
  const soloDia =
    /^\d{4}-\d{2}-\d{2}$/.test(t) ||
    /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t) ||
    /^\d{1,2}\s+\d{1,2}\s+\d{2,4}$/.test(t)

  if (soloDia) return formatearSoloFecha(t)
  return formatearFechaConHora(t) ?? formatearSoloFecha(t)
}

function valorFechaDb(db: Record<string, unknown>, ...claves: string[]): string | null {
  for (const clave of claves) {
    const valor = db[clave]
    if (typeof valor === 'string' && valor.trim()) return valor.trim()
  }
  return null
}

function objetoAnidado(raw: Record<string, unknown>, clave: string): Record<string, unknown> {
  const valor = raw[clave]
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    return valor as Record<string, unknown>
  }
  return {}
}

function formatearValor(valor: unknown, clave: string): string | null {
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'boolean') return null
  if (typeof valor === 'number' && !Number.isNaN(valor)) return String(valor)
  if (typeof valor === 'string') {
    const t = valor.trim()
    if (!t || t.startsWith('{') || t.startsWith('[') || t.startsWith('http')) return null
    if (clave.toLowerCase().includes('fecha')) {
      return formatearFechaDetalle(t)
    }
    return t
  }
  return null
}

function texto(valor: unknown): string | null {
  if (typeof valor === 'string' && valor.trim()) return valor.trim()
  if (typeof valor === 'number' && !Number.isNaN(valor)) return String(valor)
  return null
}

function fechaTexto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const t = valor.trim()
  return t ? t : null
}
