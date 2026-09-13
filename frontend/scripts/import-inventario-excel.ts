/**
 * Publica el Excel local en Supabase (requiere service role).
 *
 * 1. Ejecuta supabase/sql/inventario-saldos.sql en el SQL Editor
 * 2. Agrega SUPABASE_SERVICE_ROLE_KEY a frontend/.env.local
 * 3. npm run import:inventario
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { cargarInventarioDesdeExcel } from '../lib/inventario/parse-excel'

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    const value = trimmed.slice(eq + 1)
    if (!process.env[key]) process.env[key] = value
  }
}

async function main() {
  loadEnvLocal()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
    process.exit(1)
  }

  const datos = cargarInventarioDesdeExcel()
  if (!datos) {
    console.error('No se encontró archivos/Saldos de inventario.xlsx')
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { error: deleteError } = await supabase.from('inventario_saldos').delete().neq('codigo', '')
  if (deleteError) {
    console.error('Error al limpiar inventario_saldos:', deleteError.message)
    console.error('¿Ejecutaste supabase/sql/inventario-saldos.sql?')
    process.exit(1)
  }

  const filasDb = datos.filas.map((fila) => ({
    codigo: fila.codigo,
    nombre: fila.nombre,
    unidad: fila.unidad,
    categoria: fila.categoria,
    ubicacion: fila.ubicacion,
    saldo: fila.saldo,
    valor_unitario: fila.valor_unitario,
    valor_total: fila.valor_total,
    updated_at: new Date().toISOString(),
  }))

  const BATCH = 400
  for (let i = 0; i < filasDb.length; i += BATCH) {
    const { error } = await supabase.from('inventario_saldos').insert(filasDb.slice(i, i + BATCH))
    if (error) {
      console.error('Error insertando lote:', error.message)
      process.exit(1)
    }
  }

  const { error: metaError } = await supabase.from('inventario_saldos_meta').upsert({
    id: 1,
    fecha_corte: datos.fechaCorte,
    total_productos: datos.filas.length,
    imported_at: new Date().toISOString(),
    imported_by: null,
  })

  if (metaError) {
    console.error('Error actualizando meta:', metaError.message)
    process.exit(1)
  }

  console.log(`OK: ${datos.filas.length} productos publicados (${datos.fechaCorte ?? 'sin fecha corte'})`)
}

main()
