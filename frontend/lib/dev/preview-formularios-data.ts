import type { FormularioListado } from '@/lib/types/formularios'

export function getDevPreviewFormulariosData(): FormularioListado[] {
  const baseDate = new Date('2026-09-13T08:00:00Z')

  return Array.from({ length: 45 }, (_, i) => {
    const esEntrada = i % 2 === 0
    const tipoFormulario = esEntrada ? 'ingreso' : 'salida'
    const created_at = new Date(baseDate.getTime() - i * 4 * 60 * 60 * 1000).toISOString()

    const rawData = {
      tipoFormulario,
      datosGenerales: {
        chasis: `CH${(100000 + i).toString()}`,
        marca: 'Toyota',
        ciudad: 'Bogotá',
        fechaIngreso: esEntrada ? '2026-09-13' : '2026-09-12',
        fechaSalida: esEntrada ? '' : '2026-09-13',
        kilometraje: 1200 + i,
      },
      firmas: {
        recibe: { nombre: 'Operario demo', empresa: 'Carrera Arango SAS', cedula: '12345678' },
        entrega: { nombre: 'Cliente demo', empresa: 'Transportes SA', cedula: '87654321' },
      },
      fotos: ['https://example.com/foto1.jpg', 'https://example.com/foto2.jpg'],
    }

    const dbColumns = {
      created_at,
      saved_at: created_at,
      tipo_formulario: tipoFormulario,
      dg_chasis: rawData.datosGenerales.chasis,
      dg_marca: rawData.datosGenerales.marca,
      dg_ciudad: rawData.datosGenerales.ciudad,
      dg_kilometraje: rawData.datosGenerales.kilometraje,
      numero_formulario: 1000 + i,
      foto_count: 2,
      firma_recibe_nombre: 'Operario demo',
      firma_entrega_nombre: 'Cliente demo',
    }

    return {
      id: `form-preview-${1000 + i}`,
      tipo: tipoFormulario,
      created_at,
      rawData,
      dbColumns,
      data: {
        tipoFormulario,
        datosGenerales_chasis: rawData.datosGenerales.chasis,
        datosGenerales_marca: rawData.datosGenerales.marca,
        datosGenerales_ciudad: rawData.datosGenerales.ciudad,
        datosGenerales_fechaIngreso: rawData.datosGenerales.fechaIngreso,
        datosGenerales_fechaSalida: rawData.datosGenerales.fechaSalida,
        datosGenerales_kilometraje: rawData.datosGenerales.kilometraje,
      },
    }
  })
}
