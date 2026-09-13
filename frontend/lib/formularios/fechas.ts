const ZONA_BOGOTA = 'America/Bogota'

export function parsearFecha(valor: unknown): Date | null {
  if (valor === null || valor === undefined || valor === '') return null

  if (typeof valor === 'number' && !Number.isNaN(valor)) {
    if (valor < 1_000_000_000) return null
    const ms = valor > 1_000_000_000_000 ? valor : valor * 1000
    return new Date(ms)
  }

  if (typeof valor !== 'string') return null

  const texto = valor.trim()
  if (!texto || texto.startsWith('{') || texto.startsWith('[')) return null

  const isoSoloFecha = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoSoloFecha) {
    const [, y, m, d] = isoSoloFecha
    return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0)
  }

  const dmy = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0)
  }

  const dmyHora = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/)
  if (dmyHora) {
    const [, d, m, y, hh, mm] = dmyHora
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm))
  }

  const mdyEspaciado = texto.match(/^(\d{1,2})\s+(\d{1,2})\s+(\d{2,4})$/)
  if (mdyEspaciado) {
    const [, m, d, yRaw] = mdyEspaciado
    const y = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw)
    return new Date(y, Number(m) - 1, Number(d), 12, 0, 0)
  }

  return null
}

export function formatearFechaCompacta(valor: unknown): string | null {
  const fecha = parsearFecha(valor)
  if (!fecha) return null

  return fecha.toLocaleDateString('es-CO', {
    timeZone: ZONA_BOGOTA,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatearSoloFecha(valor: unknown): string | null {
  const fecha = parsearFecha(valor)
  if (!fecha) return null

  return fecha.toLocaleDateString('es-CO', {
    timeZone: ZONA_BOGOTA,
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatearFechaConHora(valor: unknown): string | null {
  const fecha = parsearFecha(valor)
  if (!fecha) return null

  return fecha.toLocaleString('es-CO', {
    timeZone: ZONA_BOGOTA,
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function clasificarCampoFecha(clave: string, valor: unknown): 'fecha' | 'fecha_hora' | 'texto' {
  const k = clave.toLowerCase()

  if (typeof valor === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) return 'fecha'
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(valor.trim())) return 'fecha'
    if (/^\d{1,2}\/\d{1,2}\/\d{4}\s+\d/.test(valor.trim())) return 'fecha_hora'
  }

  if (k.includes('hora') || k.includes('time') || k.includes('timestamp')) return 'fecha_hora'
  if (k.includes('fecha') || k.includes('date')) return 'fecha'
  if (k.includes('ingreso') || k.includes('salida') || k.includes('entry') || k.includes('exit')) {
    return 'fecha_hora'
  }

  return 'texto'
}

export function formatearCampo(valor: unknown, clave: string): string | null {
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'object') return null

  const tipo = clasificarCampoFecha(clave, valor)

  if (tipo === 'fecha') return formatearSoloFecha(valor)
  if (tipo === 'fecha_hora') return formatearFechaConHora(valor)

  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
  if (typeof valor === 'number') return String(valor)
  if (typeof valor === 'string') {
    const t = valor.trim()
    if (!t || t.startsWith('{') || t.startsWith('[')) return null
    return t
  }

  return String(valor)
}
